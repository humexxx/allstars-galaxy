"use client";

import type { PadelData } from "@/types/sports";

import { RacquetView } from "./racquet-view";

type PadelViewProps = {
  data: PadelData;
};

export function PadelView({ data }: PadelViewProps) {
  return (
    <RacquetView
      emoji="🎾"
      title="Padel"
      subtitle={`World Padel Tour · Season ${data.men.season}`}
      tours={[
        { value: "men", label: "Men", data: data.men },
        { value: "women", label: "Women", data: data.women },
      ]}
    />
  );
}
