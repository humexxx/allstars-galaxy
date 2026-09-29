import type { Metadata } from "next";
import Link from "next/link";
import { LineChart, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PlansWorkspace } from "@/components/finance/plans-workspace";
import type { PlanSummary } from "@/types/finance";
import type { PlanTimeline } from "@/lib/finance/chart-series";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserPlansWithLines } from "@/lib/services/finance-plan-service";
import { loadPlanOverviews } from "@/lib/services/finance-snapshot-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

export const metadata: Metadata = {
  title: "Plans",
  description: "Compare scenarios for your personal finances",
};

export const dynamic = "force-dynamic";

export default async function FinancePlansPage() {
  const ctx = await requireEffectiveContext();
  const plans = await listUserPlansWithLines(ctx.effectiveUserId);

  // Every plan calibrated and projected exactly as its own page does it
  // (latest confirmation, fixed end date, the reader's today), so the rail's
  // figures and the chart match what the plan page shows.
  const timeZone = await getRequestTimeZone();
  const today = todayInTimeZone(timeZone);
  const overviews = await loadPlanOverviews(plans, ctx.effectiveUserId, today, timeZone);
  const summaries: Record<string, PlanSummary> = Object.fromEntries(
    overviews.map((o) => [o.plan.id, o.summary])
  );
  const timelines: Record<string, PlanTimeline> = Object.fromEntries(
    overviews.map((o) => [o.plan.id, o.timeline])
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Finance Plans"
        description="Build scenarios for your income, expenses, debts and projected net worth."
        actions={
          <Button asChild>
            <Link href="/portal/plans/new">
              <Plus />
              New plan
            </Link>
          </Button>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          variant="card"
          icon={LineChart}
          title="No plans yet"
          description="Create your first plan to start modelling income, debts and savings."
          action={
            <Button asChild>
              <Link href="/portal/plans/new">
                <Plus />
                Create plan
              </Link>
            </Button>
          }
        />
      ) : (
        // One plan or twenty: the workspace is the same surface. A single plan
        // still gets its projection curve, and the rail grows into a real
        // comparison as scenarios are added.
        <PlansWorkspace
          plans={plans}
          summaries={summaries}
          timelines={timelines}
          today={today}
        />
      )}
    </section>
  );
}
