/**
 * How many months apart the plan table's rows sit for a horizon: every month
 * up to a year, every other month for two, every six for five, every year
 * beyond — so each horizon lists about a dozen rows.
 */
export function rowStepFor(horizonMonths: number): number {
  if (horizonMonths <= 12) return 1;
  if (horizonMonths <= 24) return 2;
  if (horizonMonths <= 60) return 6;
  return 12;
}

/**
 * The rows to list: every row before `from` (the closed periods leading in),
 * then `from` and every `step`-th row after it.
 */
export function sampleRows<T>(rows: readonly T[], from: number, step: number): T[] {
  const start = Math.max(0, from);
  return rows.filter((_, i) => i < start || (i - start) % Math.max(1, step) === 0);
}
