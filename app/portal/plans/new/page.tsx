import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PlanForm } from "@/components/finance/plan-form";
import { requireEffectiveContext } from "@/lib/services/impersonation";

export const metadata: Metadata = {
  title: "New plan | Capital Galaxy",
};

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  await requireEffectiveContext();
  return (
    <section className="space-y-6">
      <PageHeader
        title="New plan"
        description="Set the basics, then add income, expenses and debts on the next screen."
      />
      <PlanForm />
    </section>
  );
}
