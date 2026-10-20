/**
 * A task's due date against today, both days in the reader's zone (see
 * `../zoned-date`).
 */

import { daysBetween } from "../zoned-date";

export { dayKey, formatZonedShortDay as formatDueDay } from "../zoned-date";

export type DueTone = "overdue" | "today" | "tomorrow" | "later";

/** How a due day relates to `today` (both `YYYY-MM-DD`). */
export function dueTone(due: string, today: string): DueTone {
  const days = daysBetween(today, due);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "later";
}
