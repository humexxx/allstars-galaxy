import type { FinancePlanDebt, Projection } from "@/types/finance";

import { periodRangeFor } from "./period";
import { isoDay } from "./schedule";

// Outside the projections' span there is no simulated balance to read, so a
// debt chip falls back to its configured payment: the fixed amount, or for a
// percent-of-balance card the stated payment / floor as a lower bound.
export function debtCalendarAmount(d: FinancePlanDebt): number {
  const payment = Number(d.monthlyPayment);
  if (d.paymentType === "fixed") return payment;
  const floor = Number(d.minPaymentFloor);
  return payment > 0 ? payment : floor;
}

/**
 * The debt payments the projection actually made — keyed
 * `${debtId}:${YYYY-MM-DD}` at the amount paid (percent-of-balance minimum
 * applied, the last payment capped at what was owed) — plus the day span the
 * projections cover. Inside that span a debt with no payment on a day shows
 * no chip (paid off, or skipped); outside it the configured amount stands in.
 * Exported for tests.
 */
export type ProjectedDebtPayments = {
  byKey: Map<string, number>;
  coverage: { start: number; end: number }[];
};

export function projectedDebtPayments(
  projections: readonly Projection[]
): ProjectedDebtPayments {
  const byKey = new Map<string, number>();
  const coverage: { start: number; end: number }[] = [];
  for (const p of projections) {
    const first = p.months[0];
    const last = p.months[p.months.length - 1];
    if (!first || !last) continue;
    const anchor = p.plan.confirmationDayOfMonth > 0 ? p.plan.confirmationDayOfMonth : 1;
    coverage.push({
      start: first.date.getTime(),
      end: periodRangeFor(last.date, anchor).end.getTime(),
    });
    for (const m of p.months) {
      for (const d of m.debts) {
        for (const pay of d.payments) {
          const key = `${d.debtId}:${isoDay(pay.date)}`;
          // The first projection (the calibrated one) wins where both cover.
          if (!byKey.has(key)) byKey.set(key, pay.amount);
        }
      }
    }
  }
  return { byKey, coverage };
}

/** Amount for a debt chip on `day`, or null when no payment lands there. */
export function debtChipAmount(
  debt: FinancePlanDebt,
  day: Date,
  lookup: ProjectedDebtPayments
): number | null {
  const found = lookup.byKey.get(`${debt.id}:${isoDay(day)}`);
  if (found !== undefined) return found;
  const t = day.getTime();
  const covered = lookup.coverage.some((c) => t >= c.start && t <= c.end);
  return covered ? null : debtCalendarAmount(debt);
}

