"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/typography";
import { formatTripMoney } from "@/lib/travel/format";
import { cn } from "@/lib/utils";

export type TravellerView = {
  id: string;
  name: string;
  owed: number;
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
 * The total is the anchor — it is the one figure that does not move when you
 * click a different face — so it is what shows by default. Selecting somebody
 * swaps it for their share, because "the trip costs $5,200" and "you owe
 * $2,600" are different questions and only one of them is answered by dividing.
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "inline-flex items-baseline gap-2 rounded-full px-3 py-1",
          "bg-white/15 backdrop-blur-sm"
        )}
      >
        <Mono className="text-base font-semibold text-white sm:text-lg">
          {active
            ? formatTripMoney(active.owed, currency)
            : ranged
              ? `${formatTripMoney(total, currency)} – ${formatTripMoney(totalHigh, currency)}`
              : formatTripMoney(total, currency)}
        </Mono>
        <span className="text-xs text-white/70">
          {active ? `${active.name} pays` : "total"}
        </span>
      </span>

      {travellers.length > 0 && (
        <div className="flex items-center gap-1">
          {travellers.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected === t.id}
              title={`${t.name} — ${formatTripMoney(t.owed, currency)}`}
              onClick={() => setSelected((cur) => (cur === t.id ? null : t.id))}
              className={cn(
                "grid size-8 place-items-center rounded-full text-2xs font-semibold transition",
                selected === t.id
                  ? "bg-white text-black"
                  : "bg-white/20 text-white hover:bg-white/30"
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
        className="h-8 gap-1 px-2 text-white/80 hover:bg-white/15 hover:text-white"
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
