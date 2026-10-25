"use client";

import { tourLine } from "@/lib/sports/racquet";
import type { PadelData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type PadelViewProps = {
  data: PadelData;
};

export function PadelView({ data }: PadelViewProps): React.ReactElement {
  return (
    <RacquetView
      sport="padel"
      title="Padel"
      subtitle={tourLine("padel", data.men.season)}
      data={data.men}
    />
  );
}
