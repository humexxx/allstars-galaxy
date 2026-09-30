import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Projection, TodayState } from "@/types/finance";
import { idSchema } from "@/schemas/common";

import { PlanEditor } from "@/components/finance/plan-editor";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { listInvestmentMethods } from "@/lib/services/investment-method-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";
import {
  compareDebtStrategies,
  getPlanWithLines,
  projectPlan,
  projectStateAt,
  projectionOptionsFor,
} from "@/lib/services/finance-plan-service";
import {
  calibratePlan,
  getRecentMonthlySnapshots,
  loadCalibratedView,
} from "@/lib/services/finance-snapshot-service";
import { getUserPortfolio } from "@/lib/services/portfolio-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // A non-uuid would reach Postgres as a cast error and a 500.
  if (!idSchema.safeParse(id).success) return { title: "Plan" };
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  return {
    title: plan ? plan.name : "Plan",
  };
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  if (!plan) notFound();

  // One "today" for the whole render, in the READER'S time zone (the tz
  // cookie): the current period, the KPIs and the chart all derive from it.
  const timeZone = await getRequestTimeZone();
  const now = todayInTimeZone(timeZone);

  // A scenario opens on its base plan's as-of day, so an unchanged scenario
  // and its base project identically (see `compareScenario`).
  const basePlan = plan.basedOnPlanId
    ? await getPlanWithLines(plan.basedOnPlanId, ctx.effectiveUserId)
    : null;
  const baseRaw = basePlan ? calibratePlan(basePlan, null, { timeZone }) : null;
  const calibration = { timeZone, asOfFallback: baseRaw?.asOf ?? null };

  // The calibrated plan (latest confirmation as the opening, on its day) is
  // what every figure on the page projects; the raw `plan` is what the line
  // and debt editors mutate.
  const [view, preferences, investmentMethods, history] = await Promise.all([
    loadCalibratedView(plan, ctx.effectiveUserId, now, calibration),
    getUserPreferences(ctx.effectiveUserId),
    listInvestmentMethods({ includeDisabled: true }),
    // Real recorded history for the chart's past. 36 months covers the
    // largest horizon's ~25% past budget.
    getRecentMonthlySnapshots(
      plan.id,
      ctx.effectiveUserId,
      36,
      now,
      plan.confirmationDayOfMonth
    ),
  ]);
  const { baseline, projection, options, today } = view;

  // The plan as written (no confirmation applied): the hover fallback for
  // periods before the calibration start, the chart's past while the plan has
  // never been confirmed, and the scenario comparison basis.
  const rawPlan = calibratePlan(plan, null, calibration);
  const rawOptions = await projectionOptionsFor(rawPlan, ctx.effectiveUserId);
  const pastProjection =
    baseline.baselineSource === "plan"
      ? projection
      : projectPlan(rawPlan, rawPlan.incomes, rawPlan.expenses, rawPlan.debts, rawOptions);

  // Scenario overlay: the base plan projected from its plan as written, the
  // same footing as `pastProjection` for this plan (confirmations are not
  // copied into a scenario, so comparing a calibrated base with an
  // uncalibrated scenario showed deltas for an unchanged clone).
  let ghost: {
    name: string;
    color: string;
    projection: Projection;
    today: TodayState | null;
  } | null = null;
  if (basePlan && baseRaw) {
    const baseOptions = await projectionOptionsFor(baseRaw, ctx.effectiveUserId);
    ghost = {
      name: basePlan.name,
      color: basePlan.color,
      projection: projectPlan(baseRaw, baseRaw.incomes, baseRaw.expenses, baseRaw.debts, baseOptions),
      today: projectStateAt(baseRaw, baseRaw.incomes, baseRaw.expenses, baseRaw.debts, baseOptions, now),
    };
  }
  const scenarioBasis = ghost
    ? projectPlan(rawPlan, rawPlan.incomes, rawPlan.expenses, rawPlan.debts, rawOptions)
    : null;

  // Recorded portfolio history feeds the chart's past segment of the portfolio
  // series when the plan includes the portfolio.
  let portfolioHistory: { date: Date; value: number }[] = [];
  if (baseline.includePortfolio) {
    const portfolio = await getUserPortfolio(ctx.effectiveUserId);
    if (portfolio) {
      const points = await getPortfolioPerformanceData(portfolio.id, "All");
      portfolioHistory = points.map((p) => ({ date: new Date(p.date), value: p.value }));
    }
  }

  // Strategy comparison, with exactly the options the chart beside it used
  // (portfolio growth included) and the plan's own surplus-to-debts share.
  const comparison =
    baseline.debts.length > 0
      ? compareDebtStrategies(
          baseline,
          baseline.incomes,
          baseline.expenses,
          baseline.debts,
          options
        )
      : null;

  return (
    <section className="flex flex-col gap-6">
      <PlanEditor
        now={now}
        plan={plan}
        baseline={baseline}
        projection={projection}
        pastProjection={pastProjection}
        simulatedPast={baseline.baselineSource === "plan" ? projection : null}
        today={today}
        history={history}
        comparison={comparison}
        investmentMethods={investmentMethods}
        ghost={ghost}
        scenarioBasis={scenarioBasis}
        portfolioHistory={portfolioHistory}
        milestones={preferences.financeMilestones}
        title={plan.name}
        description={
          plan.description ?? "Add income, expenses and debts to refine the projection."
        }
        backHref="/portal/plans"
      />
    </section>
  );
}
