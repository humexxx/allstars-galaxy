"use client";

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
      tours={[
        { value: "atp", label: "ATP", data: data.atp },
        { value: "wta", label: "WTA", data: data.wta },
      ]}
    />
  );
}
