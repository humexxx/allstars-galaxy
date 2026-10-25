"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono } from "@/components/ui/typography";
import type { DashboardTable, DashboardTableRow } from "@/types/sports";

import { TeamBadge } from "./shared/team-badge";

/**
 * The top of a sport's table on its dashboard card, one table at a time when
 * there are two (East / West, AFC / NFC).
 *
 * A client island inside a server card: which table is showing is the only
 * state, so that is all that ships.
 */
export function DashboardSportTables({ tables }: { tables: DashboardTable[] }) {
  const [active, setActive] = useState(tables[0]?.id);
  const table = tables.find((t) => t.id === active) ?? tables[0];
  if (!table) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* A segmented control, not Tabs: one list swaps its rows. */}
      {tables.length > 1 ? (
        <ToggleGroup
          type="single"
          size="sm"
          value={table.id}
          onValueChange={(v) => v && setActive(v)}
          aria-label="Table"
        >
          {tables.map((t) => (
            <ToggleGroupItem key={t.id} value={t.id}>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <Eyebrow size="sm" asChild>
          <h3>{table.label}</h3>
        </Eyebrow>
      )}
      <ol role="list" className="flex flex-col gap-1">
        {table.rows.map((row) => (
          <li
            key={`${table.id}-${row.position}-${row.name}`}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 odd:bg-muted/40"
          >
            {!table.unranked && (
              <Mono className="w-4 shrink-0 text-2xs text-muted-foreground">{row.position}</Mono>
            )}
            <RowImage row={row} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.name}</span>
            <Mono className="shrink-0 text-xs">{row.value}</Mono>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A player's face, a team's crest, or what stands in for them. */
function RowImage({ row }: { row: DashboardTableRow }) {
  if (row.image?.kind === "photo") {
    return (
      <span className="relative size-6 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- ESPN's and the padel API's CDNs; an allowlist breaks the day either moves. */}
        <img src={row.image.url} alt="" className="size-full object-cover object-top" />
        {row.flagEmoji && (
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 text-2xs leading-none">
            {row.flagEmoji}
          </span>
        )}
      </span>
    );
  }
  if (row.code || row.image) {
    return (
      <TeamBadge
        team={{
          name: row.name,
          shortName: row.name,
          code: row.code ?? row.name.slice(0, 3),
          primaryColor: row.color,
          logoUrl: row.image?.url,
        }}
        size="sm"
      />
    );
  }
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs">
      {row.flagEmoji ?? "·"}
    </span>
  );
}
