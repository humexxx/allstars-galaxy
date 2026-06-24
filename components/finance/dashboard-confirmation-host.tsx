import {
  getMainPlan,
  getPlanWithLines,
} from "@/lib/services/finance-plan-service";
import { getConfirmationStatus } from "@/lib/services/finance-confirmation-service";
import { periodRangeFor } from "@/lib/finance/period";

import { ConfirmationPrompt } from "./confirmation-prompt";

// UTC-anchored — monthAnchor is generated at UTC midnight, so local formatting
// would shift a month in negative-offset timezones.
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Period-mode label shows the actual window (e.g. "Jun 15 – Jul 14") so the
// popup matches the plan editor's dialog instead of collapsing to a month name.
const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Resolves on the server whether the user's MAIN plan is due for monthly
 * confirmation today, and renders the auto-opening prompt if so. Only the
 * main plan can trigger this popup — secondary plans never auto-prompt,
 * which avoids stacking dialogs and keeps the dashboard focused.
 */
export async function DashboardConfirmationHost({ userId }: { userId: string }) {
  const main = await getMainPlan(userId);
  if (!main || main.confirmationDayOfMonth === 0) return null;

  const full = await getPlanWithLines(main.id, userId);
  if (!full) return null;

  const status = await getConfirmationStatus(full, userId);
  if (!status.isDue || !status.projectedState) return null;

  const projectedDebts = status.projectedState.debts.map((d) => ({
    debtId: d.debtId,
    name: d.name,
    balance: d.balance,
  }));

  // status.monthAnchor is the period start (ISO). In period mode (anchor day
  // > 1) show the window; otherwise the month + year.
  const anchorIso = new Date(status.monthAnchor);
  const monthLabel =
    main.confirmationDayOfMonth > 1
      ? (() => {
          const range = periodRangeFor(anchorIso, main.confirmationDayOfMonth);
          return `${DAY_LABEL.format(range.start)} – ${DAY_LABEL.format(range.end)}`;
        })()
      : MONTH_LABEL.format(anchorIso);

  return (
    <ConfirmationPrompt
      planId={main.id}
      planName={main.name}
      monthLabel={monthLabel}
      projected={{
        savings: status.projectedState.savings,
        investments: status.projectedState.investments,
        debts: projectedDebts,
      }}
      debts={full.debts}
    />
  );
}
