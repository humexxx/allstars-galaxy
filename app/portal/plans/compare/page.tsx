import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CompareView } from "@/components/finance/compare-view";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getPlanWithLines,
  listUserPlans,
  projectPlanWithPortfolio,
} from "@/lib/services/finance-plan-service";

export const metadata: Metadata = {
  title: "Compare plans | Allstars Galaxy",
};

export const dynamic = "force-dynamic";

export default async function ComparePlansPage() {
  const ctx = await requireEffectiveContext();
  const plans = await listUserPlans(ctx.effectiveUserId);

  if (plans.length < 2) {
    return (
      <section className="space-y-6">
        <PageHeader
          title="Compare plans"
          description="Stack scenarios side by side."
        />
        <EmptyState
          variant="card"
          title="Need at least two plans"
          description="Create another plan to start comparing scenarios."
          action={
            <Button asChild>
              <Link href="/portal/plans">Back to plans</Link>
            </Button>
          }
        />
      </section>
    );
  }

  const projections = await Promise.all(
    plans.map(async (p) => {
      const full = await getPlanWithLines(p.id, ctx.effectiveUserId);
      // full is guaranteed since we just listed plans owned by the user.
      return projectPlanWithPortfolio(full!, ctx.effectiveUserId);
    })
  );

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
        title="Compare plans"
        description="See every plan&apos;s projection in the same chart."
      />
      <CompareView projections={projections} />
    </section>
  );
}
