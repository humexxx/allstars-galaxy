"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Mono, Text } from "@/components/ui/typography";
import { formatTripMoney } from "@/lib/travel/format";
import { cn } from "@/lib/utils";

export type TravellerView = {
  id: string;
  name: string;
  owed: number;
  /** The signed-in owner. Marked rather than left for the reader to work out
   *  which pair of initials is theirs. */
  isYou?: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Who is going, and what the selected person pays.
 *
 * Sits on a photograph, so the surface is a solid dark pill rather than a
 * translucent one: a light-wash cover (a beach, a snowfield) leaves white text
 * on white through any amount of transparency, and a scrim that only sometimes
 * works is worse than one that always does.
 *
 * The pill is a fixed size. Switching from "you pay" to "Bruno Fabián pays"
 * changes the caption's length, and letting the box breathe with it made the
 * whole banner twitch every time a face was clicked.
 */
export function TravellerBar({
  travellers,
  total,
  totalHigh,
  currency,
  onManage,
}: {
  travellers: TravellerView[];
  total: number;
  /** Upper end when the trip's estimate is a range. */
  totalHigh: number;
  currency: string;
  onManage: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = travellers.find((t) => t.id === selected) ?? null;
  const ranged = totalHigh > total;

  const amount = active
    ? formatTripMoney(active.owed, currency)
    : ranged
      ? `${formatTripMoney(total, currency)} – ${formatTripMoney(totalHigh, currency)}`
      : formatTripMoney(total, currency);

  const caption = active
    ? active.isYou
      ? "you pay"
      : `${active.name} pays`
    : "trip total";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "flex min-w-56 flex-col justify-center rounded-xl px-3 py-2",
          // Solid, not translucent: the photograph underneath is unknown.
          "bg-black/70 backdrop-blur-sm ring-1 ring-white/15"
        )}
      >
        <Mono className="truncate text-lg font-semibold leading-tight text-white tabular-nums">
          {amount}
        </Mono>
        {/* Fixed line so the box height never moves between captions. */}
        <Text className="truncate text-2xs leading-tight text-white/70">{caption}</Text>
      </div>

      {travellers.length > 0 && (
        <div className="flex items-center gap-1">
          {/* An explicit way back to the total — clicking the selected face
              again also works, but nothing on screen said so. */}
          <button
            type="button"
            aria-pressed={selected === null}
            title="Whole trip"
            onClick={() => setSelected(null)}
            className={cn(
              "grid h-8 place-items-center rounded-full px-2.5 text-2xs font-semibold transition",
              selected === null
                ? "bg-white text-black"
                : "bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/75"
            )}
          >
            All
          </button>

          {travellers.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected === t.id}
              title={`${t.name}${t.isYou ? " (you)" : ""} — ${formatTripMoney(t.owed, currency)}`}
              onClick={() => setSelected((cur) => (cur === t.id ? null : t.id))}
              className={cn(
                "grid size-8 place-items-center rounded-full text-2xs font-semibold transition",
                selected === t.id
                  ? "bg-white text-black"
                  : "bg-black/60 text-white ring-1 ring-white/20 hover:bg-black/75",
                // A ring, not a colour: "this one is you", not a different
                // kind of traveller.
                t.isYou && selected !== t.id && "ring-2 ring-white/70"
              )}
            >
              {initials(t.name)}
            </button>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1 bg-black/60 px-2 text-white/90 ring-1 ring-white/20 hover:bg-black/75 hover:text-white"
        onClick={onManage}
      >
        {travellers.length === 0 ? (
          <>
            <Plus className="size-3.5" /> Add travellers
          </>
        ) : (
          <Users className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
