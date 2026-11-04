/**
 * The colours a trip can be: the chart palette's five categorical slots, in
 * their order (see "Chart colours" in CLAUDE.md). The trip form offers them;
 * the travel assistant gives a new trip the first one none of the user's
 * trips is wearing.
 */
export const TRIP_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** The first slot not in `used`; the first slot again once all five are taken. */
export function nextTripColor(used: Iterable<string>): string {
  const taken = new Set(used);
  return TRIP_COLORS.find((c) => !taken.has(c)) ?? TRIP_COLORS[0];
}
