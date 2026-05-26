import type { Metadata } from "next";

import { db } from "@/db";
import { investmentMethods } from "@/db/schema";
import { asc } from "drizzle-orm";

import { InvestmentMethodsView } from "@/components/portfolio/investment-methods-view";

export const metadata: Metadata = {
  title: "Investment Methods | Allstars Galaxy",
  description: "Explore available investment methods and strategies",
};

export const dynamic = "force-dynamic";

export default async function InvestmentMethodsPage() {
  // Fetch enabled + disabled. The view hides disabled methods by default; the
  // dev drawer exposes a toggle to reveal them. Keeping the filter client-side
  // avoids a second round-trip when a tester flips it.
  const methods = await db
    .select()
    .from(investmentMethods)
    .orderBy(asc(investmentMethods.author), asc(investmentMethods.name));

  return <InvestmentMethodsView methods={methods} />;
}
