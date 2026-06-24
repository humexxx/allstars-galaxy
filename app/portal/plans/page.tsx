import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PlansList, type PlanSummary } from "@/components/finance/plans-list";
import { PlansWorkspace } from "@/components/finance/plans-workspace";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getPlanWithLines,
  listUserPlans,
  projectPlanWithPortfolio,
} from "@/lib/services/finance-plan-service";

export const metadata: Metadata = {
  title: "Plans | Allstars Galaxy",
  description: "Compare scenarios for your personal finances",
};

export const dynamic = "force-dynamic";

export default async function FinancePlansPage() {
  const ctx = await requireEffectiveContext();
  const plans = await listUserPlans(ctx.effectiveUserId);

  // Project every plan so each card can surface its outcome (debt-free date +
  // projected net worth) and the plans can be stacked in one comparison chart.
  // Personal-finance plans are few, so the per-plan projection cost is fine.
  const projections = await Promise.all(
    plans.map(async (p) => {
      const full = await getPlanWithLines(p.id, ctx.effectiveUserId);
      return projectPlanWithPortfolio(full!, ctx.effectiveUserId);
    })
  );

  const summaries: Record<string, PlanSummary> = Object.fromEntries(
    projections.map((proj) => [
      proj.plan.id,
      {
        monthsToDebtFree: proj.monthsToDebtFree,
        endingNetWorth: proj.endingNetWorth,
        endingDebt: proj.endingDebt,
        endDate: proj.months.at(-1)?.date ?? null,
      },
    ])
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="Finance Plans"
        description="Build scenarios for your income, expenses, debts and projected net worth."
        actions={
          <Button asChild>
            <Link href="/portal/plans/new">
              <Plus className="mr-1 h-4 w-4" />
              New plan
            </Link>
          </Button>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          variant="card"
          title="No plans yet"
          description="Create your first plan to start modelling income, debts and savings."
          action={
            <Button asChild>
              <Link href="/portal/plans/new">
                <Plus className="mr-1 h-4 w-4" />
                Create plan
              </Link>
            </Button>
          }
        />
      ) : plans.length === 1 ? (
        <PlansList plans={plans} summaries={summaries} />
      ) : (
        <PlansWorkspace
          plans={plans}
          summaries={summaries}
          projections={projections}
        />
      )}
    </section>
  );
}
