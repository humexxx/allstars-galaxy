import { getPlanWithLines, listUserPlans } from "@/lib/services/finance-plan-service";
import { getConfirmationStatus } from "@/lib/services/finance-confirmation-service";

import { ConfirmationPrompt } from "./confirmation-prompt";

// UTC-anchored — monthAnchor is generated at UTC midnight, so local formatting
// would shift a month in negative-offset timezones.
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Resolves on the server whether any of the user's plans is due for a monthly
 * confirmation today. Renders the auto-opening ConfirmationPrompt for the first
 * plan that's due. Only one popup at a time to avoid stacking dialogs.
 */
export async function DashboardConfirmationHost({ userId }: { userId: string }) {
  const plans = await listUserPlans(userId);
  if (plans.length === 0) return null;

  for (const plan of plans) {
    if (plan.confirmationDayOfMonth === 0) continue;
    const full = await getPlanWithLines(plan.id, userId);
    if (!full) continue;
    const status = await getConfirmationStatus(full, userId);
    if (!status.isDue || !status.projectedState) continue;

    const projectedDebts = status.projectedState.debts.map((d) => ({
      debtId: d.debtId,
      name: d.name,
      balance: d.balance,
    }));

    return (
      <ConfirmationPrompt
        planId={plan.id}
        planName={plan.name}
        monthLabel={MONTH_LABEL.format(new Date(status.monthAnchor))}
        projected={{
          savings: status.projectedState.savings,
          investments: status.projectedState.investments,
          debts: projectedDebts,
        }}
        debts={full.debts}
      />
    );
  }

  return null;
}
