"use client";

import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Mono, Text } from "@/components/ui/typography";
import { formatTripMoney } from "@/lib/travel/format";
import { cn } from "@/lib/utils";

export type TravellerView = {
  id: string;
  name: string;
  /** What they owe, low and high — a trip full of estimates gives every
   *  person an estimate too. */
  owedLow: number;
  owedHigh: number;
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

/** "$600" alone, or "$600 – $800" when the two ends differ. */
export function moneyRange(low: number, high: number, currency: string): string {
  return high > low
    ? `${formatTripMoney(low, currency)} – ${formatTripMoney(high, currency)}`
    : formatTripMoney(low, currency);
}

/**
 * Who is going, and what the selected person pays.
 *
 * The selection lives in the parent because it drives the itinerary too:
 * picking a face has to re-cost every day, not just relabel this pill.
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
  selected,
  onSelect,
  onManage,
}: {
  travellers: TravellerView[];
  total: number;
  /** Upper end when the trip's estimate is a range. */
  totalHigh: number;
  currency: string;
  /** Traveller whose share is showing, or null for the whole trip. */
  selected: string | null;
  onSelect: (id: string | null) => void;
  onManage: () => void;
}) {
  const active = travellers.find((t) => t.id === selected) ?? null;

  const amount = active
    ? moneyRange(active.owedLow, active.owedHigh, currency)
    : moneyRange(total, totalHigh, currency);

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
            onClick={() => onSelect(null)}
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
              title={`${t.name}${t.isYou ? " (you)" : ""} — ${moneyRange(t.owedLow, t.owedHigh, currency)}`}
              onClick={() => onSelect(selected === t.id ? null : t.id)}
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
