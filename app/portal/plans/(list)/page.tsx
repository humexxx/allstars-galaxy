import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { PlansWorkspace } from "@/components/finance/plans-workspace";
import type { PlanSummary } from "@/types/finance";
import type { PlanTimeline } from "@/lib/finance/chart-series";

import { requireModulePage } from "@/lib/services/module-access-service";
import { listUserPlansWithLines } from "@/lib/services/finance-plan-service";
import { getLastConfirmedDay } from "@/lib/services/finance-confirmation-service";
import { loadPlanOverviews } from "@/lib/services/finance-snapshot-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

export const metadata: Metadata = {
  title: "Plans",
  description: "Compare scenarios for your personal finances",
};

export const dynamic = "force-dynamic";

export default async function FinancePlansPage() {
  const ctx = await requireModulePage("plans");
  const plans = await listUserPlansWithLines(ctx.effectiveUserId);

  // Every plan calibrated and projected exactly as its own page does it
  // (latest confirmation, fixed end date, the reader's today), so the rail's
  // figures and the chart match what the plan page shows.
  const timeZone = await getRequestTimeZone();
  const today = todayInTimeZone(timeZone);
  const [overviews, lastConfirmedDay] = await Promise.all([
    loadPlanOverviews(plans, ctx.effectiveUserId, today, timeZone),
    getLastConfirmedDay(ctx.effectiveUserId),
  ]);
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
        actions={
          <Button asChild>
            <Link href="/portal/plans/new">
              <Plus />
              New plan
            </Link>
          </Button>
        }
      />

      {/* None, one or twenty: the workspace is the same surface. A single
          plan still gets its projection curve, and the rail grows into a real
          comparison as scenarios are added. */}
      <PlansWorkspace
        plans={plans}
        summaries={summaries}
        timelines={timelines}
        today={today}
        lastConfirmedDay={lastConfirmedDay}
      />
    </section>
  );
}
