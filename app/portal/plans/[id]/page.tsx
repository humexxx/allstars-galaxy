import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlanEditor } from "@/components/finance/plan-editor";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  compareDebtStrategies,
  getAutoInvestRate,
  getPlanWithLines,
  getPortfolioValueForUser,
  listInvestmentMethods,
  projectPlanWithPortfolio,
} from "@/lib/services/finance-plan-service";
import {
  buildCalibratedPlan,
  getRecentMonthlySnapshots,
} from "@/lib/services/finance-snapshot-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  return {
    title: plan ? `${plan.name} | Allstars Galaxy` : "Plan | Allstars Galaxy",
  };
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  if (!plan) notFound();

  // Calibrate from the latest confirmation so the projection (and the chart's
  // forward line) starts from the user's most recent real numbers instead of
  // the original plan baseline. Returns the plan unchanged when there are no
  // confirmations. The raw `plan` is still what the editor mutates.
  const baseline = await buildCalibratedPlan(plan);

  const [portfolioValue, autoInvestRate, investmentMethods, history] =
    await Promise.all([
      baseline.includePortfolio
        ? getPortfolioValueForUser(ctx.effectiveUserId)
        : Promise.resolve(0),
      getAutoInvestRate(baseline),
      listInvestmentMethods({ includeDisabled: true }),
      // Real recorded history for the chart's past (today → backwards). 36
      // months covers the largest horizon's ~25% past budget; empty for fresh
      // plans, which fall back to the projected past.
      getRecentMonthlySnapshots(
        plan.id,
        ctx.effectiveUserId,
        36,
        new Date(),
        plan.confirmationDayOfMonth
      ),
    ]);

  const projection = await projectPlanWithPortfolio(baseline, ctx.effectiveUserId);
  // Raw (un-calibrated) projection — spans back to the plan's start. The chart
  // uses it to re-simulate the past when there are no real snapshots yet, so
  // confirming the current period (which calibrates `projection` to start at
  // today) doesn't blank the chart's history. Same object when no confirmation.
  const pastProjection =
    baseline === plan
      ? projection
      : await projectPlanWithPortfolio(plan, ctx.effectiveUserId);
  // Strategy comparison only meaningful when there's something to compare.
  const comparison =
    baseline.debts.length > 0
      ? compareDebtStrategies(
          baseline,
          baseline.incomes,
          baseline.expenses,
          baseline.debts,
          { portfolioValue, autoInvestRate }
        )
      : null;

  return (
    <section className="space-y-4">
      <PlanEditor
        plan={plan}
        baseline={baseline}
        projection={projection}
        pastProjection={pastProjection}
        history={history}
        comparison={comparison}
        investmentMethods={investmentMethods}
        title={plan.name}
        description={
          plan.description ?? "Add income, expenses and debts to refine the projection."
        }
        backHref="/portal/plans"
      />
    </section>
  );
}
