import "server-only";

import { db } from "@/db";
import { appState, investmentMethods, transactions } from "@/db/schema";
import { eq, and, gt, lte, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * `app_state` key holding the latest month interest was compounded for: an
 * ISO instant inside that UTC month. Months up to and including it are done.
 */
export const LAST_INTEREST_RUN_KEY = "last_interest_run";

/** "YYYY-MM" — the UTC calendar month `when` falls in, the cron's clock. */
export function interestMonthOf(when: Date): string {
  return when.toISOString().slice(0, 7);
}

export type MonthlyInterestRun =
  | { applied: true; month: string; processed: number; closed: number }
  | { applied: false; month: string };

/**
 * Compound one month of interest — at most once per month, whichever path
 * asks (the daily cron, or the admin's manual snapshot).
 *
 * The month is claimed first and in the SAME transaction as the compounding,
 * so the two commit or roll back together. The old read-then-write let two
 * concurrent runs both see the month open, and a record written after the
 * compounding committed could fail on its own and leave the month open for
 * the next run to compound again.
 *
 * @param forMonth - an instant in the month being compounded
 * @param beforeDate - only compound buys dated on or before this instant
 */
export async function applyMonthlyInterest(
  forMonth: Date,
  beforeDate?: Date
): Promise<MonthlyInterestRun> {
  const month = interestMonthOf(forMonth);
  return db.transaction(async (tx) => {
    if (!(await claimInterestMonth(tx, forMonth))) {
      return { applied: false, month };
    }
    const { processed, closed } = await compoundActiveBuys(tx, beforeDate);
    return { applied: true, month, processed, closed };
  });
}

/**
 * Move the record to `forMonth`'s month, only if it is later than the one on
 * record. Returns whether this call took the month.
 *
 * An upsert whose update is conditional: the conflicting row is locked until
 * commit, so a concurrent claim for the same month waits, then re-checks the
 * condition against the committed value and gets nothing back. With no row
 * yet, the second insert waits on the first the same way.
 */
async function claimInterestMonth(tx: Tx, forMonth: Date): Promise<boolean> {
  const month = interestMonthOf(forMonth);
  const value = forMonth.toISOString();
  const now = new Date();

  const claimed = await tx
    .insert(appState)
    .values({ key: LAST_INTEREST_RUN_KEY, value, error: null, updatedAt: now })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value, error: null, updatedAt: now },
      // A value that is not an ISO instant names no month, so it blocks none.
      setWhere: sql`${appState.value} IS NULL OR ${appState.value} !~ '^[0-9]{4}-[0-9]{2}' OR left(${appState.value}, 7) < ${month}`,
    })
    .returning({ key: appState.key });

  return claimed.length > 0;
}

/**
 * currentValue = currentValue * (1 + monthlyRoi%) on every active buy; a buy
 * whose value reaches <= 0 is marked 'closed'.
 *
 * One UPDATE with the arithmetic in the database, not read-then-write: a
 * withdrawal approved between our read and our write had its new
 * currentValue overwritten with a value computed from the old one. Postgres
 * re-reads a row changed under a running UPDATE, so this always compounds the
 * current value — and `numeric` rounds exactly, where `toFixed` on a float
 * could land a cent off.
 */
async function compoundActiveBuys(
  tx: Tx,
  beforeDate?: Date
): Promise<{ processed: number; closed: number }> {
  const conditions = [
    eq(transactions.status, "approved"),
    eq(transactions.type, "buy"),
    gt(transactions.currentValue, "0"),
  ];

  if (beforeDate) {
    conditions.push(lte(transactions.date, beforeDate));
  }

  const roi = sql`coalesce((select ${investmentMethods.monthlyRoi} from ${investmentMethods} where ${investmentMethods.id} = ${transactions.investmentMethodId}), 0)`;
  const next = sql`round(${transactions.currentValue} * (1 + ${roi} / 100), 2)`;

  const rows = await tx
    .update(transactions)
    .set({
      currentValue: sql`${next}`,
      status: sql`case when ${next} <= 0 then 'closed'::transaction_status else 'approved'::transaction_status end`,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ status: transactions.status });

  return {
    processed: rows.length,
    closed: rows.filter((r) => r.status === "closed").length,
  };
}
