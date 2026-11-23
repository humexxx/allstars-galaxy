import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PortalPageContainer } from "@/components/portal/page-container";
import { CalorieCalculator } from "@/components/wellness/calorie-calculator";
import { requireModulePage } from "@/lib/services/module-access-service";

export const metadata: Metadata = {
  title: "Calories",
  description: "Daily calories and macros for your body, activity and goal",
};

export default async function CaloriesPage(): Promise<React.ReactElement> {
  await requireModulePage("wellness");

  return (
    <PortalPageContainer>
      <PageHeader
        title="Calories"
        description="What you burn in a day, and what to eat to lose, keep or gain weight."
      />
      <CalorieCalculator />
    </PortalPageContainer>
  );
}
