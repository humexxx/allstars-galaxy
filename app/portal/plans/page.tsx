import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PlansList } from "@/components/finance/plans-list";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserPlans } from "@/lib/services/finance-plan-service";

export const metadata: Metadata = {
  title: "Plans | Allstars Galaxy",
  description: "Compare scenarios for your personal finances",
};

export const dynamic = "force-dynamic";

export default async function FinancePlansPage() {
  const ctx = await requireEffectiveContext();
  const plans = await listUserPlans(ctx.effectiveUserId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Finance Plans"
        description="Build scenarios for your income, expenses, debts and projected net worth."
        actions={
          <div className="flex items-center gap-2">
            {plans.length >= 2 && (
              <Button variant="outline" asChild>
                <Link href="/portal/plans/compare">Compare plans</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/portal/plans/new">
                <Plus className="mr-1 h-4 w-4" />
                New plan
              </Link>
            </Button>
          </div>
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
      ) : (
        <PlansList plans={plans} />
      )}
    </section>
  );
}
