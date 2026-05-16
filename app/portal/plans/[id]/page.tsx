import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { PlanEditor } from "@/components/finance/plan-editor";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getPlanWithLines,
  projectPlanWithPortfolio,
} from "@/lib/services/finance-plan-service";

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

  const projection = await projectPlanWithPortfolio(plan, ctx.effectiveUserId);

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
      <PlanEditor plan={plan} projection={projection} />
    </section>
  );
}
