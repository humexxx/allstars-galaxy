/**
 * The colours a plan can wear by default: the chart palette's five
 * categorical slots, in their order (see "Chart colours" in CLAUDE.md). The
 * plan form and the rail's picker offer them; every new plan and every copy
 * gets the first one none of the user's plans is wearing, so two plans on the
 * comparison chart never share a line colour by accident.
 */
export const PLAN_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/**
 * The first slot not in `used`. With all five taken, the one fewest plans
 * wear (the earliest on a tie), rather than piling every later plan onto the
 * first slot.
 */
export function nextPlanColor(used: Iterable<string>): string {
  const count = new Map<string, number>(PLAN_COLORS.map((c) => [c, 0]));
  for (const c of used) if (count.has(c)) count.set(c, count.get(c)! + 1);
  let best: string = PLAN_COLORS[0];
  for (const c of PLAN_COLORS) if (count.get(c)! < count.get(best)!) best = c;
  return best;
}
