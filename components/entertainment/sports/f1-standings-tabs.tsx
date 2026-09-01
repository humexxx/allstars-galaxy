"use client";

import Image from "next/image";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { F1StandingRow } from "@/lib/services/espn-f1-standings-service";

/** Black or white, whichever reads on that livery. Same rule as `TeamBadge`. */
function readableInk(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#111" : "#fff";
}

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
  const [tab, setTab] = useState("drivers");
  const rows = tab === "drivers" ? drivers : constructors;

  return (
    <div className="flex flex-col gap-2">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-7">
          <TabsTrigger value="drivers" className="text-2xs">
            Drivers
          </TabsTrigger>
          <TabsTrigger value="constructors" className="text-2xs">
            Constructors
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={`${tab}-${row.position}-${row.name}`}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 odd:bg-muted/40"
          >
            <Mono className="w-4 shrink-0 text-2xs tabular-nums text-muted-foreground">
              {row.position}
            </Mono>
            <Portrait row={row} />
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

/** A driver's face, a constructor's logo, or its livery as a last resort. */
function Portrait({ row }: { row: F1StandingRow }) {
  if (row.logoUrl) {
    // The same circle a driver's photo gets. It is filled with `muted` rather
    // than white so it reads as part of the card instead of a lit disc — the
    // marks are unplated (see the service), so the fill is a real choice here.
    return (
      <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image
          src={row.logoUrl}
          alt=""
          fill
          sizes="28px"
          className="object-contain p-0.5"
        />
      </span>
    );
  }

  if (row.imageUrl) {
    return (
      <span className="relative size-7 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image
          src={row.imageUrl}
          alt=""
          fill
          sizes="28px"
          className="object-cover object-top"
          // ESPN's CDN, and its path is derived from the athlete id — an
          // allowlist would break the day either changes.
          unoptimized
        />
        {row.flagUrl && (
          <span className="absolute bottom-0 right-0 size-3 overflow-hidden rounded-full ring-1 ring-background">
            <Image src={row.flagUrl} alt="" fill sizes="12px" className="object-cover" unoptimized />
          </span>
        )}
      </span>
    );
  }

  // A team with no logo published yet — the livery does the work.
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-2xs font-semibold ring-1 ring-black/10"
      )}
      style={{
        backgroundColor: row.color ?? "#666",
        color: readableInk(row.color),
      }}
    >
      {(row.code ?? row.name).slice(0, 3).toUpperCase()}
    </span>
  );
}
