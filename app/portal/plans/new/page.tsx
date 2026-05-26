import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PlanForm } from "@/components/finance/plan-form";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listInvestmentMethods } from "@/lib/services/finance-plan-service";

export const metadata: Metadata = {
  title: "New plan | Allstars Galaxy",
};

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  await requireEffectiveContext();
  // Auto-invest picker can use disabled methods as hypothetical scenarios.
  const investmentMethods = await listInvestmentMethods({ includeDisabled: true });
  return (
    <section className="space-y-6">
      <PageHeader
        title="New plan"
        description="Set the basics, then add income, expenses and debts on the next screen."
      />
      <PlanForm investmentMethods={investmentMethods} />
    </section>
  );
}
