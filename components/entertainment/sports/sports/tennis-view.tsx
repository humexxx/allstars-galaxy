"use client";

import type { NewsStory, TennisData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type TennisViewProps = {
  data: TennisData;
  /** Each tour's news, ESPN's. */
  news?: Record<keyof TennisData, NewsStory[]>;
  /** `?tab=news` opens on the news. */
  initialTab?: string;
};

export function TennisView({ data, news, initialTab }: TennisViewProps) {
  return (
    <RacquetView
      sport="tennis"
      emoji="🎾"
      title="Tennis"
      subtitle={`Season ${data.atp.season}`}
      tours={[
        { value: "atp", label: "ATP", data: data.atp, news: news?.atp },
        { value: "wta", label: "WTA", data: data.wta, news: news?.wta },
      ]}
      initialTab={initialTab}
    />
  );
}
