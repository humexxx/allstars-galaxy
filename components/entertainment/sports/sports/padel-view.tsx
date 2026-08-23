"use client";

import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import type { PadelData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type PadelViewProps = {
  data: PadelData;
};

export function PadelView({ data }: PadelViewProps) {
  return (
    <RacquetView
      // From the registry, so this cannot drift back to the tennis ball the
      // tab strip no longer uses.
      emoji={SPORTS_BY_ID.get("padel")!.emoji}
      title="Padel"
      // Premier Padel, not World Padel Tour: WPT was absorbed into Premier
      // Padel in 2024, and padelapi.org — what this reads — covers Premier
      // Padel and FIP.
      subtitle={`Premier Padel · Season ${data.men.season}`}
      tours={[
        { value: "men", label: "Men", data: data.men },
        { value: "women", label: "Women", data: data.women },
      ]}
    />
  );
}
