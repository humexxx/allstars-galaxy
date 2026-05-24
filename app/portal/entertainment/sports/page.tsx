import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { SportsHub } from "@/components/entertainment/sports/sports-hub";

export const metadata: Metadata = {
  title: "Sports | Allstars Galaxy",
  description: "Live scores, standings and brackets across your favourite sports.",
};

export default function SportsPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Sports"
        description="Live scores, tables, tournaments and brackets across football, F1, NBA, tennis, padel, NFL and League of Legends."
      />
      <SportsHub />
    </section>
  );
}
