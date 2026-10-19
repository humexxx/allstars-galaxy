/**
 * Money owed to the user: income lines marked `owedToMe` — a relative paying
 * back a loan, a friend settling up. Every repayment still to come is an
 * asset the user already holds, so net worth counts it from today. When one
 * lands it turns into cash and the amount owed shrinks by the same figure,
 * which leaves net worth where it was.
 *
 * Pure, like the projection engine that reads it.
 */
import type { FinancePlanIncome } from "@/types/finance";

import { RESCHEDULE_MARGIN_MONTHS, parseIsoDay, planOccurrences, type ScheduleSource } from "./schedule";

export type OwedRepayment = { date: Date; amount: number };

type OwedIncome = ScheduleSource["incomes"][number] & Pick<FinancePlanIncome, "owedToMe">;

type OwedSource = {
  startMonth: Date;
  incomes: readonly OwedIncome[];
  overrides?: ScheduleSource["overrides"];
};

// The schema makes a recurring receivable carry an end date. One that got in
// without it is cut off here instead of being owed forever.
const OPEN_ENDED_CAP_YEARS = 30;

function addMonthsUtc(day: Date, months: number): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + months, day.getUTCDate()));
}

/**
 * Every repayment of money owed to the user dated on or after `from`, oldest
 * first. Recurring lines are walked to their own end date, past the plan's
 * horizon if need be: a loan repaid in 2030 is owed today even when the plan
 * only looks a year ahead.
 */
export function owedRepayments(source: OwedSource, from: Date): OwedRepayment[] {
  const owed = source.incomes.filter((line) => line.owedToMe);
  if (owed.length === 0) return [];

  const cap = addMonthsUtc(from, OPEN_ENDED_CAP_YEARS * 12);
  let lastDay = from;
  for (const line of owed) {
    const end = parseIsoDay(line.kind === "one_time" ? line.date : line.endDate) ?? cap;
    if (end.getTime() > lastDay.getTime()) lastDay = end;
  }
  // An end date only fixes the month, and a reschedule can push the last
  // occurrence a couple of months past it.
  const to = addMonthsUtc(lastDay, RESCHEDULE_MARGIN_MONTHS + 1);

  return planOccurrences(
    { startMonth: source.startMonth, incomes: owed, expenses: [], debts: [], overrides: source.overrides },
    from,
    to
  )
    .map((o) => ({ date: o.date, amount: o.amount ?? 0 }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** What is still owed once `day` is over: every repayment dated after it. */
export function owedAfter(repayments: readonly OwedRepayment[], day: Date): number {
  let total = 0;
  for (const r of repayments) {
    if (r.date.getTime() > day.getTime()) total += r.amount;
  }
  return total;
}
