/**
 * Cash as it is shown: never below zero. The plan sends a period's whole
 * surplus to its debts at the close, so the bills that land before the next
 * income take the projected cash under zero for a few days — money the user
 * really paid from what the plan had already sent to debt. It is a gap in the
 * forecast's timing, not an overdraft, so it stays inside net worth but no
 * figure called Cash shows it.
 */
export function shownCash(savings: number): number {
  return Math.max(0, savings);
}
