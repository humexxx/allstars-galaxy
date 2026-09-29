import type { Metadata } from "next";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CompareView } from "@/components/finance/compare-view";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  listUserPlansWithLines,
  projectPlanWithPortfolio,
} from "@/lib/services/finance-plan-service";

export const metadata: Metadata = {
  title: "Compare plans",
};

export const dynamic = "force-dynamic";

const BACK = { href: "/portal/plans", label: "Plans" };

export default async function ComparePlansPage() {
  const ctx = await requireEffectiveContext();
  const plans = await listUserPlansWithLines(ctx.effectiveUserId);

  if (plans.length < 2) {
    return (
      <section className="flex flex-col gap-6">
        <PageHeader
          back={BACK}
          title="Compare plans"
          description="Stack scenarios side by side."
        />
        <EmptyState
          variant="card"
          icon={GitCompareArrows}
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
    plans.map((p) => projectPlanWithPortfolio(p, ctx.effectiveUserId))
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        back={BACK}
        title="Compare plans"
        description="See every plan’s projection in the same chart."
      />
      <CompareView projections={projections} />
    </section>
  );
}
