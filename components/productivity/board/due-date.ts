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

/**
 * A column that reads as finished. Nothing on a task records completion, so
 * an overdue warning would otherwise stay red on every card somebody has
 * already moved to "Done".
 */
export function isDoneColumnName(name: string): boolean {
  return /\b(done|complete(d)?|finished|closed|shipped)\b/i.test(name);
}
