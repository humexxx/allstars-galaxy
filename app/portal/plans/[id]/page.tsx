import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
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
import { getRecentMonthlySnapshots } from "@/lib/services/finance-snapshot-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  return {
    title: plan ? `${plan.name} | Capital Galaxy` : "Plan | Capital Galaxy",
  };
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const plan = await getPlanWithLines(id, ctx.effectiveUserId);
  if (!plan) notFound();

  const [portfolioValue, autoInvestRate, investmentMethods, historicalSnapshots] =
    await Promise.all([
      plan.includePortfolio
        ? getPortfolioValueForUser(ctx.effectiveUserId)
        : Promise.resolve(0),
      getAutoInvestRate(plan),
      listInvestmentMethods({ includeDisabled: true }),
      getRecentMonthlySnapshots(plan.id, ctx.effectiveUserId, 3),
    ]);

  const projection = await projectPlanWithPortfolio(plan, ctx.effectiveUserId);
  // Strategy comparison only meaningful when there's something to compare.
  const comparison =
    plan.debts.length > 0
      ? compareDebtStrategies(plan, plan.incomes, plan.expenses, plan.debts, {
          portfolioValue,
          autoInvestRate,
        })
      : null;

  return (
    <section className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/portal/plans">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to plans
          </Link>
        </Button>
      </div>
      <PageHeader
        title={plan.name}
        description={plan.description ?? "Add income, expenses and debts to refine the projection."}
      />
      <PlanEditor
        plan={plan}
        projection={projection}
        comparison={comparison}
        investmentMethods={investmentMethods}
        historicalSnapshots={historicalSnapshots}
      />
    </section>
  );
}
