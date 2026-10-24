"use client";

import type { NewsStory, TennisData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type TennisViewProps = {
  data: TennisData;
  /** The ATP's news, ESPN's. */
  news?: NewsStory[];
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function TennisView({ data, news, initialTab }: TennisViewProps) {
  return (
    <RacquetView
      sport="tennis"
      emoji="🎾"
      title="Tennis"
      subtitle={`ATP · Season ${data.atp.season}`}
      data={data.atp}
      news={news}
      initialTab={initialTab}
    />
  );
}
