"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatWeekdayDay } from "@/lib/utils/date";
import type { TripItemStop } from "@/types/travel";

/**
 * A multi-day activity's day-by-day stops — a cruise's ports.
 *
 * Rendered as a timeline rather than a table: the reader's question is "where
 * am I on the 20th", which is a sequence, and a table of four columns makes
 * them scan across for an answer that belongs in a single line.
 *
 * `note` is printed as the operator wrote it. Itineraries state arrival and
 * departure inconsistently ("Departs 4:30 PM" vs "Docked 7:00 AM – 4:00 PM"),
 * and normalising that would lose what the traveller actually needs to read.
 */
export function ItemItinerary({ stops }: { stops: TripItemStop[] }) {
  // Collapsed by default: eight ports is a wall of text under an activity you
  // were only glancing at, and the ports are a detail of the cruise rather
  // than of the day it starts.
  const [open, setOpen] = useState(false);
  if (stops.length === 0) return null;

  return (
    // shadcn's Collapsible (Radix) rather than a hand-rolled button: it brings
    // the aria wiring and keyboard behaviour a disclosure needs, and this
    // project uses shadcn primitives rather than one-off equivalents.
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
        {open ? "Hide itinerary" : `Itinerary · ${stops.length} days`}
      </CollapsibleTrigger>

      <CollapsibleContent>
    <ol className="mt-2 border-l pl-4">
      {stops.map((stop) => (
        <li key={stop.id} className="relative py-2">
          <span
            aria-hidden
            // Centred on the 1px rail: the list's 16px padding, half the
            // rail, half the 8px dot — 21px, a scale step.
            className="absolute -left-5.25 top-3.5 size-2 rounded-full bg-muted-foreground/40 ring-2 ring-background"
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Mono className="text-2xs uppercase tracking-wide text-muted-foreground">
              Day {stop.dayNumber}
            </Mono>
            {stop.stopOn && (
              <Mono className="text-2xs text-muted-foreground">
                {formatWeekdayDay(stop.stopOn)}
              </Mono>
            )}
          </div>
          <Text weight="medium">{stop.place}</Text>
          {stop.note && <Text variant="small">{stop.note}</Text>}
        </li>
      ))}
    </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
