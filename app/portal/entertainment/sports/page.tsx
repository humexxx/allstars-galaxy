import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { ManageFavoritesSheet } from "@/components/entertainment/sports/manage-favorites-sheet";
import { SportsHub } from "@/components/entertainment/sports/sports-hub";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";

export const metadata: Metadata = {
  title: "Sports | Allstars Galaxy",
  description: "Live scores, standings and brackets across your favourite sports.",
};

export const dynamic = "force-dynamic";

export default async function SportsPage() {
  const ctx = await requireEffectiveContext();
  const favorites = await listUserFavoriteSportIds(ctx.effectiveUserId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Sports"
        description="Live scores, tables, tournaments and brackets across football, F1, NBA, tennis, padel, NFL and League of Legends."
        actions={<ManageFavoritesSheet favoriteSportIds={favorites} />}
      />
      <SportsHub favoriteSportIds={favorites} />
    </section>
  );
}
