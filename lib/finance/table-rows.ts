import type { ProjectionMonth } from "@/types/finance";

/**
 * Keep the first 12 rows, then one row per year: the period that starts in
 * DECEMBER (a real year-end, whatever month the window starts in), plus the
 * last row.
 */
export function densify(months: ProjectionMonth[]): ProjectionMonth[] {
  if (months.length <= 24) return months;
  const kept: ProjectionMonth[] = [];
  for (let i = 0; i < months.length; i++) {
    if (i < 12 || months[i].date.getUTCMonth() === 11) kept.push(months[i]);
  }
  if (kept[kept.length - 1] !== months[months.length - 1]) {
    kept.push(months[months.length - 1]);
  }
  return kept;
}

