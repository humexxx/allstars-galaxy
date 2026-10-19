"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Mono } from "@/components/ui/typography";
import type { F1StandingRow } from "@/types/sports";

import { Portrait } from "./shared/portrait";

/**
 * The top of both championships, one at a time.
 *
 * A client island inside a server card: the only thing that needs state is
 * which table is showing, so that is all that ships.
 */
export function F1StandingsTabs({
  drivers,
  constructors,
}: {
  drivers: F1StandingRow[];
  constructors: F1StandingRow[];
}) {
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const rows = tab === "drivers" ? drivers : constructors;

  return (
    <div className="flex flex-col gap-2">
      {/* A segmented control, not Tabs: one list swaps its rows, there are no
          panels for tab triggers to point at. */}
      <ToggleGroup
        type="single"
        size="sm"
        value={tab}
        onValueChange={(v) => v && setTab(v as typeof tab)}
        aria-label="Championship"
      >
        <ToggleGroupItem value="drivers">Drivers</ToggleGroupItem>
        <ToggleGroupItem value="constructors">Constructors</ToggleGroupItem>
      </ToggleGroup>

      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={`${tab}-${row.position}-${row.name}`}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 odd:bg-muted/40"
          >
            <Mono className="w-4 shrink-0 text-2xs tabular-nums text-muted-foreground">
              {row.position}
            </Mono>
            <Portrait subject={row} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {row.name}
            </span>
            <Mono className="shrink-0 text-xs tabular-nums">{row.points}</Mono>
            <span className="shrink-0 text-2xs text-muted-foreground">pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
