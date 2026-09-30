import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  financePlanConfirmations,
  financePlanDebtConfirmations,
  financePlanDebts,
  financePlans,
} from "@/db/schema";

import {
  isDateInPeriod,
  nextPeriodStart,
  periodRangeFor,
  periodStartFor,
} from "@/lib/finance/period";
import { isoDay, parseIsoDay } from "@/lib/finance/schedule";

import { ensureOwnedRow } from "./ownership";
import type { ConfirmationData } from "@/schemas/finance-confirmations";
import {
  createConfirmationSnapshot,
  getProjectedStateForMonth,
  getProjectedStateOnDay,
} from "./finance-snapshot-service";
import type {
  ConfirmationWithDebts,
  FinancePlanConfirmation,
  FinancePlanWithLines,
  TodayState,
} from "@/types/finance";

// ---------- helpers ----------

/** Effective anchor day: 0 (confirmations off) behaves like calendar months. */
function anchorOf(day: number): number {
  return day > 0 ? day : 1;
}

/** The calendar day a confirmation row describes (UTC midnight). */
function rowDay(row: { confirmationMonth: string }): Date {
  return parseIsoDay(row.confirmationMonth) ?? new Date(row.confirmationMonth);
}

async function ensurePlanOwnership(
  planId: string,
  userId: string
): Promise<{ confirmationDayOfMonth: number }> {
  const plan = await ensureOwnedRow({
    table: financePlans,
    idColumn: financePlans.id,
    id: planId,
    userId,
    entity: "Plan",
  });
  return { confirmationDayOfMonth: plan.confirmationDayOfMonth };
}

// ---------- public API ----------

/**
 * The confirmation that sets the plan's baseline — the one describing the
 * LATEST day — plus its per-debt balances.
 *
 * `confirmationMonth` holds that day: the calendar day a user confirmed on,
 * or the period start an auto row records the opening of. Ordering by it is
 * ordering by the day the balances describe.
 */
export async function getLatestConfirmation(
  planId: string
): Promise<ConfirmationWithDebts | null> {
  const [latest] = await db
    .select()
    .from(financePlanConfirmations)
    .where(eq(financePlanConfirmations.planId, planId))
    .orderBy(
      desc(financePlanConfirmations.confirmationMonth),
      desc(financePlanConfirmations.confirmedAt)
    )
    .limit(1);

  if (!latest) return null;

  const debtConfirmations = await db
    .select()
    .from(financePlanDebtConfirmations)
    .where(eq(financePlanDebtConfirmations.confirmationId, latest.id));

  return { ...latest, debtConfirmations };
}

/**
 * Whether the plan still needs a confirmation for the period containing
 * `today` (the reader's calendar day), and what the dialog should pre-fill.
 *
 * A confirmation counts for the period that CONTAINS its day, not by an exact
 * key match — so rows saved under an older anchor day keep counting after the
 * anchor changes, instead of the prompt re-firing beside them.
 */
export async function getConfirmationStatus(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date = new Date()
): Promise<{
  isDue: boolean;
  monthAnchor: string;
  projectedState: TodayState | null;
  existingConfirmation: FinancePlanConfirmation | null;
}> {
  const period = periodRangeFor(today, anchorOf(plan.confirmationDayOfMonth));
  if (plan.confirmationDayOfMonth === 0) {
    return {
      isDue: false,
      monthAnchor: isoDay(period.start),
      projectedState: null,
      existingConfirmation: null,
    };
  }

  const rows = await db
    .select()
    .from(financePlanConfirmations)
    .where(eq(financePlanConfirmations.planId, plan.id));
  const existing =
    rows
      .filter((r) => isDateInPeriod(rowDay(r), period))
      .sort((a, b) => rowDay(b).getTime() - rowDay(a).getTime())[0] ?? null;

  // Pre-fill = the projected position ON today: that is what a confirmation
  // records, so saving the pre-fill unchanged doesn't move anything.
  const projectedState = await getProjectedStateOnDay(plan, userId, today);

  return {
    isDue: !existing,
    monthAnchor: isoDay(period.start),
    projectedState,
    existingConfirmation: existing,
  };
}

/**
 * Save (upsert) a confirmation of the balances ON `today` — the reader's
 * calendar day — and write a paired snapshot tagged `confirmation`.
 *
 * The row is keyed by that day, which is also the plan's new as-of day:
 * anything dated on/before it is in the confirmed balances, anything after
 * it is still to come. Confirming again the same day replaces the row.
 */
export async function saveConfirmation(
  userId: string,
  input: ConfirmationData,
  today: Date = new Date()
): Promise<FinancePlanConfirmation> {
  await ensurePlanOwnership(input.planId, userId);

  const day = isoDay(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  );
  // Debt ids are caller-supplied. A balance recorded against another plan's
  // debt would feed that plan's calibration, so every id must be this plan's.
  if (input.debtBalances.length > 0) {
    const ids = [...new Set(input.debtBalances.map((d) => d.debtId))];
    const owned = await db
      .select({ id: financePlanDebts.id })
      .from(financePlanDebts)
      .where(and(eq(financePlanDebts.planId, input.planId), inArray(financePlanDebts.id, ids)));
    if (owned.length !== ids.length) throw new Error("Debt not found");
  }

  const conf = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financePlanConfirmations)
      .values({
        planId: input.planId,
        confirmationMonth: day,
        confirmedSavings: input.confirmedSavings,
        confirmedInvestments: input.confirmedInvestments,
        notes: input.notes ?? null,
        source: "user",
      })
      .onConflictDoUpdate({
        target: [
          financePlanConfirmations.planId,
          financePlanConfirmations.confirmationMonth,
        ],
        set: {
          confirmedSavings: input.confirmedSavings,
          confirmedInvestments: input.confirmedInvestments,
          notes: input.notes ?? null,
          // A manual confirm over an auto-rolled row promotes it to "user".
          source: "user",
          confirmedAt: new Date(),
        },
      })
      .returning();

    // Replace any prior per-debt confirmations for this confirmation.
    await tx
      .delete(financePlanDebtConfirmations)
      .where(eq(financePlanDebtConfirmations.confirmationId, row.id));

    if (input.debtBalances.length > 0) {
      await tx.insert(financePlanDebtConfirmations).values(
        input.debtBalances.map((d) => ({
          confirmationId: row.id,
          debtId: d.debtId,
          confirmedBalance: d.confirmedBalance,
        }))
      );
    }

    return row;
  });

  // Snapshot is written outside the txn so a failure here doesn't roll back
  // the confirmation itself — the next cron run will heal the missing snapshot.
  try {
    // Stamped now (or the start of the reader's day, if that is later — a
    // reader ahead of UTC just after midnight) so it outranks any cron
    // snapshot already written today.
    await createConfirmationSnapshot(
      input.planId,
      userId,
      new Date(Math.max(Date.now(), today.getTime()))
    );
  } catch (err) {
    console.error("createConfirmationSnapshot after saveConfirmation failed:", err);
  }

  return conf;
}

/**
 * Roll the baseline forward through any CLOSED period the user left
 * unconfirmed. Runs from the daily cron before snapshots.
 *
 *   - The CURRENT period is never auto-confirmed — the user is still prompted.
 *   - Every period strictly between the latest confirmation's period (or the
 *     plan start when there is none) and the current period is closed. Each
 *     one with no confirmation DATED INSIDE IT gets a `source: "auto"` row
 *     recording its projected OPENING, keyed by its period start, chaining the
 *     baseline forward one period at a time.
 *
 * Periods are matched by containment, so rows saved under an older anchor day
 * still count and no duplicate is written beside them.
 * No-op when confirmations are off (`confirmationDayOfMonth === 0`).
 */
export async function autoConfirmSkippedPeriods(
  plan: FinancePlanWithLines,
  userId: string,
  today: Date = new Date()
): Promise<{ confirmationsCreated: number }> {
  const anchor = plan.confirmationDayOfMonth;
  if (anchor === 0) return { confirmationsCreated: 0 };

  const currStart = periodStartFor(today, anchor);

  // Period starts (under the CURRENT anchor) that already hold a confirmation
  // of any source.
  const existing = await db
    .select({ month: financePlanConfirmations.confirmationMonth })
    .from(financePlanConfirmations)
    .where(eq(financePlanConfirmations.planId, plan.id));
  const confirmedPeriods = new Set(
    existing.map((r) => isoDay(periodStartFor(rowDay({ confirmationMonth: r.month }), anchor)))
  );

  const latest = await getLatestConfirmation(plan.id);
  const baselineStart = latest
    ? periodStartFor(rowDay(latest), anchor)
    : periodStartFor(new Date(plan.startMonth), anchor);

  let confirmationsCreated = 0;
  let cursor = nextPeriodStart(baselineStart, anchor);
  // Hard cap so a misconfigured/very-old plan can't spin forever.
  let guard = 0;
  while (cursor.getTime() < currStart.getTime() && guard < 600) {
    guard += 1;
    const monthKey = isoDay(cursor);
    if (!confirmedPeriods.has(monthKey)) {
      // Projected opening of this skipped period, calibrated from the latest
      // confirmation so far (which includes any auto rows we just wrote).
      const opening = await getProjectedStateForMonth(plan, userId, cursor);
      if (opening) {
        const inserted = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(financePlanConfirmations)
            .values({
              planId: plan.id,
              confirmationMonth: monthKey,
              confirmedSavings: opening.savings.toFixed(2),
              confirmedInvestments: opening.investments.toFixed(2),
              notes: null,
              source: "auto",
            })
            .onConflictDoNothing({
              target: [
                financePlanConfirmations.planId,
                financePlanConfirmations.confirmationMonth,
              ],
            })
            .returning();

          // onConflictDoNothing returns nothing when the row already existed
          // (race with a concurrent run) — bail without writing debt rows.
          if (!row) return null;

          if (opening.debts.length > 0) {
            await tx.insert(financePlanDebtConfirmations).values(
              opening.debts.map((d) => ({
                confirmationId: row.id,
                debtId: d.debtId,
                confirmedBalance: Math.max(0, d.balance).toFixed(2),
              }))
            );
          }
          return row;
        });

        if (inserted) {
          confirmedPeriods.add(monthKey);
          confirmationsCreated += 1;
          // Audit snapshot tagged `confirmation`, mirroring saveConfirmation.
          try {
            await createConfirmationSnapshot(plan.id, userId, cursor);
          } catch (err) {
            console.error("auto-confirm snapshot failed:", err);
          }
        }
      }
    }
    cursor = nextPeriodStart(cursor, anchor);
  }

  return { confirmationsCreated };
}
