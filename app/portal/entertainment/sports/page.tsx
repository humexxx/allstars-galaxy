import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { ManageFavoritesSheet } from "@/components/entertainment/sports/manage-favorites-sheet";
import { SportsHub } from "@/components/entertainment/sports/sports-hub";
import { getFootballData } from "@/lib/services/football-data-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getF1Data } from "@/lib/services/jolpica-f1-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import { getTennisData } from "@/lib/services/thesportsdb-tennis-service";

export const metadata: Metadata = {
  title: "Sports | Allstars Galaxy",
  description: "Live scores, standings and brackets across your favourite sports.",
};

export const dynamic = "force-dynamic";

export default async function SportsPage() {
  const ctx = await requireEffectiveContext();
  const [
    favorites,
    lolData,
    f1Data,
    footballLeagues,
    padelData,
    tennisData,
  ] = await Promise.all([
    listUserFavoriteSportIds(ctx.effectiveUserId),
    getLolData(),
    getF1Data(),
    getFootballData(),
    getPadelData(),
    getTennisData(),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Sports"
        description="Live scores, tables, tournaments and brackets across football, F1, NBA, tennis, padel, NFL and League of Legends."
        actions={<ManageFavoritesSheet favoriteSportIds={favorites} />}
      />
      <SportsHub
        favoriteSportIds={favorites}
        lolData={lolData}
        f1Data={f1Data}
        footballLeagues={footballLeagues}
        padelData={padelData}
        tennisData={tennisData}
      />
    </section>
  );
}
