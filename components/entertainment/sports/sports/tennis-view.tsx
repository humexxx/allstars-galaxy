"use client";

import { US_OPEN_2025_PLAYERS } from "@/lib/data/sports/tennis";
import type { TennisData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type TennisViewProps = {
  data: TennisData;
};

export function TennisView({ data }: TennisViewProps) {
  return (
    <RacquetView
      emoji="🎾"
      title="Tennis"
      subtitle={`Season ${data.atp.season}`}
      players={US_OPEN_2025_PLAYERS}
      tours={[
        { value: "atp", label: "ATP", data: data.atp },
        { value: "wta", label: "WTA", data: data.wta },
      ]}
    />
  );
}
