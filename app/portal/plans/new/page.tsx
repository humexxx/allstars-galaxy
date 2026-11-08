import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PlanForm } from "@/components/finance/plan-form";
import { nextPlanColor } from "@/lib/finance/plan-colors";
import { listUserPlans } from "@/lib/services/finance-plan-service";
import { requireModulePage } from "@/lib/services/module-access-service";
import { listInvestmentMethods } from "@/lib/services/investment-method-service";
import { getRequestToday } from "@/lib/utils/request-today";

export const metadata: Metadata = {
  title: "New plan",
};

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const ctx = await requireModulePage("plans");
  // Auto-invest picker can use disabled methods as hypothetical scenarios.
  const [investmentMethods, today, plans] = await Promise.all([
    listInvestmentMethods({ includeDisabled: true }),
    getRequestToday(),
    listUserPlans(ctx.effectiveUserId),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="New plan"
        description="Set the basics, then add income, expenses and debts on the next screen."
      />
      <PlanForm
        investmentMethods={investmentMethods}
        today={today}
        defaultColor={nextPlanColor(plans.map((p) => p.color))}
      />
    </section>
  );
}
