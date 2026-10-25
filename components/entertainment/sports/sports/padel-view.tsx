"use client";

import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { tourLine } from "@/lib/sports/racquet";
import type { PadelData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type PadelViewProps = {
  data: PadelData;
};

export function PadelView({ data }: PadelViewProps) {
  return (
    <RacquetView
      sport="padel"
      // From the registry, so this cannot drift back to the tennis ball the
      // sport picker no longer uses.
      emoji={SPORTS_BY_ID.get("padel")?.emoji ?? "🏓"}
      title="Padel"
      subtitle={tourLine("padel", data.men.season)}
      data={data.men}
    />
  );
}
