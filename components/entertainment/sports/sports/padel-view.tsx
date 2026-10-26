"use client";

import { tourLine } from "@/lib/sports/racquet";
import type { NewsStory, PadelData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type PadelViewProps = {
  data: PadelData;
  /** Premier Padel's own news. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function PadelView({ data, news, initialTab }: PadelViewProps): React.ReactElement {
  return (
    <RacquetView
      sport="padel"
      title="Padel"
      subtitle={tourLine("padel", data.men.season)}
      data={data.men}
      news={news}
      initialTab={initialTab}
    />
  );
}
