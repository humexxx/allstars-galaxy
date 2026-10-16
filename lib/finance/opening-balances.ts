/**
 * Opening balances are a SET — savings, investments and every debt's balance
 * — stated as of one calendar day (`finance_plans.balances_as_of`). Anything
 * dated on/before that day is already in them.
 *
 * Editing one of them restates the whole set as of TODAY: the edited figure
 * takes the new value, and every other figure moves to where the plan
 * projects it today. Re-dating only the edited figure would leave the others
 * stated as of an older day while being treated as of today — payments made
 * in between would silently vanish (or be replayed) — and on a confirmed plan
 * the stale creation-time savings would suddenly override the confirmation.
 *
 * An edit is a figure the user CHANGED from what their form showed — never a
 * figure the form merely sent back. The plan form shows savings and
 * investments where the plan stands today and sends them only when changed;
 * the debt form shows a debt's stored opening balance and always sends it.
 * Taking an untouched stale figure as an edit re-dated it past the latest
 * confirmation and wiped that confirmation out of the projection.
 */
import type { FinancePlanWithLines, TodayState } from "@/types/finance";

import { isoDay } from "./schedule";

export type OpeningBalanceEdits = {
  /** Savings today, when the user changed them in the plan form. */
  savings?: string;
  /** Investments today, when the user changed them in the plan form. */
  investments?: string;
  /** New opening balance per EXISTING debt id. */
  debts?: Record<string, string>;
  /** A debt being added, with its opening balance. */
  addedDebtBalance?: string;
};

export type OpeningRestatement = {
  initialSavings: string;
  initialInvestments: string;
  /** Opening balance for every existing debt of the plan. */
  debtBalances: Record<string, string>;
  /** YYYY-MM-DD — the new `balances_as_of`. */
  balancesAsOf: string;
};

function cents(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function money(value: number): string {
  const r = Math.round(value * 100) / 100;
  return (r === 0 ? 0 : r).toFixed(2);
}

/** The debt edits that differ (to the cent) from the stored opening balance. */
function changedDebts(
  plan: Pick<FinancePlanWithLines, "debts">,
  edits: OpeningBalanceEdits
): Record<string, string> {
  const changed: Record<string, string> = {};
  for (const [id, balance] of Object.entries(edits.debts ?? {})) {
    const debt = plan.debts.find((d) => d.id === id);
    if (debt && cents(balance) !== cents(debt.initialBalance)) changed[id] = balance;
  }
  return changed;
}

/**
 * Cheap check, before anything is projected: whether the edits may change an
 * opening balance. Saving a form unchanged, or adding a debt with a zero
 * balance, restates nothing and must not re-date anything.
 *
 * A debt's balance is compared with its stored opening balance (what the
 * debt form shows). A savings or investments figure always may: it is
 * compared with where the plan stands today (what the plan form shows),
 * which needs the projection — see `effectiveEdits`.
 */
export function changesOpeningBalances(
  plan: Pick<FinancePlanWithLines, "debts">,
  edits: OpeningBalanceEdits
): boolean {
  if (edits.savings !== undefined || edits.investments !== undefined) return true;
  if (Object.keys(changedDebts(plan, edits)).length > 0) return true;
  return edits.addedDebtBalance !== undefined && cents(edits.addedDebtBalance) !== 0;
}

/**
 * The edits that actually change something, or null when none does. A
 * savings or investments figure equal (to the cent) to where the plan stands
 * today is dropped: rolling forward gives that same figure, and keeping it
 * would re-date the set for nothing. A figure equal only to the STORED one
 * is kept — the stored figure may be long superseded by a confirmation, and
 * typing it is how the user says it is true again today.
 */
export function effectiveEdits(
  plan: Pick<FinancePlanWithLines, "debts">,
  projectedToday: Pick<TodayState, "savings" | "investments">,
  edits: OpeningBalanceEdits
): OpeningBalanceEdits | null {
  const changed: OpeningBalanceEdits = {};
  if (edits.savings !== undefined && cents(edits.savings) !== cents(projectedToday.savings)) {
    changed.savings = edits.savings;
  }
  if (
    edits.investments !== undefined &&
    cents(edits.investments) !== cents(Math.max(0, projectedToday.investments))
  ) {
    changed.investments = edits.investments;
  }
  const debts = changedDebts(plan, edits);
  if (Object.keys(debts).length > 0) changed.debts = debts;
  if (edits.addedDebtBalance !== undefined && cents(edits.addedDebtBalance) !== 0) {
    changed.addedDebtBalance = edits.addedDebtBalance;
  }
  return Object.keys(changed).length > 0 ? changed : null;
}

/**
 * The restated set: edited figures as given, the rest from `projectedToday`
 * (where the calibrated plan stands on `today` — see `projectStateAt`).
 * `edits` must hold only real edits (`effectiveEdits`).
 */
export function restateOpeningSet(
  plan: Pick<FinancePlanWithLines, "debts">,
  projectedToday: TodayState,
  edits: OpeningBalanceEdits,
  today: Date
): OpeningRestatement {
  const projectedDebt = new Map(projectedToday.debts.map((d) => [d.debtId, d.balance]));
  const debtBalances: Record<string, string> = {};
  for (const d of plan.debts) {
    const edited = edits.debts?.[d.id];
    debtBalances[d.id] =
      edited !== undefined
        ? money(parseFloat(edited))
        : money(Math.max(0, projectedDebt.get(d.id) ?? parseFloat(d.initialBalance)));
  }
  return {
    initialSavings:
      edits.savings !== undefined ? money(parseFloat(edits.savings)) : money(projectedToday.savings),
    initialInvestments:
      edits.investments !== undefined
        ? money(parseFloat(edits.investments))
        : money(Math.max(0, projectedToday.investments)),
    debtBalances,
    balancesAsOf: isoDay(today),
  };
}
