"use client";

import { createContext, useContext, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TripItemWithStops, TripWithRelations } from "@/types/travel";
import type { TravelMark, TripPreview } from "@/types/travel-assistant";

/**
 * A proposal the user has not decided on yet, drawn on the pages themselves.
 *
 * The assistant (in the Travel Planner's layout) provides it; the trip page
 * reads it and renders the trip as the proposal would leave it, with each
 * pending row lit up. Applying or discarding from the page goes back through
 * the same handlers the chat uses.
 */
export type PendingProposal = {
  id: string;
  summary: string;
  previews: TripPreview[];
  /** How many rows it touches, for the review bar. */
  count: number;
  applying: boolean;
  apply: () => void;
  discard: () => void;
};

const ProposalContext = createContext<PendingProposal | null>(null);
export const PendingProposalProvider = ProposalContext.Provider;

export function usePendingProposal(): PendingProposal | null {
  return useContext(ProposalContext);
}

/** The preview of one trip, when the open proposal touches it. */
export function useTripPreview(tripId: string): TripPreview | null {
  const proposal = useContext(ProposalContext);
  return proposal?.previews.find((p) => p.tripId === tripId) ?? null;
}

const MarksContext = createContext<TripPreview | null>(null);

/** Makes one trip's marks available to every row the trip page draws. */
export function PendingMarks({ preview, children }: { preview: TripPreview | null; children: ReactNode }) {
  return <MarksContext.Provider value={preview}>{children}</MarksContext.Provider>;
}

export function usePendingTrip(): TripPreview | null {
  return useContext(MarksContext);
}

export type PendingRow = {
  mark: TravelMark;
  fields: string[];
  before?: TripItemWithStops;
};

/** What the proposal does to one row, if anything. */
export function usePendingMark(id: string): PendingRow | null {
  const preview = useContext(MarksContext);
  const mark = preview?.marks[id];
  if (!preview || !mark) return null;
  return { mark, fields: preview.fields[id] ?? [], before: preview.itemsBefore[id] };
}

/**
 * The pending look, one per kind of change: blue for what is coming or
 * changing, red for what is going. Each slides in, staggered by its place in
 * the list, so the proposal appears on the page rather than being on it.
 */
export function pendingRowClass(mark: TravelMark | undefined): string {
  if (!mark) return "";
  return cn(
    "animate-in fade-in fill-mode-both duration-500 ring-1 ring-inset",
    mark === "remove"
      ? "bg-destructive/5 ring-destructive/40 slide-in-from-right-2 dark:bg-destructive/10"
      : "bg-primary/5 ring-primary/40 slide-in-from-left-2 dark:bg-primary/10"
  );
}

/** Each row's entrance a beat after the one above it. */
export function pendingDelay(index: number): { animationDelay: string } {
  return { animationDelay: `${Math.min(index, 12) * 70}ms` };
}

const LABEL: Record<TravelMark, string> = { add: "New", change: "Changes", remove: "Removing" };

export function PendingBadge({ mark, className }: { mark: TravelMark; className?: string }) {
  return (
    <Badge
      variant={mark === "remove" ? "destructive" : "info"}
      className={cn("gap-1 text-2xs", className)}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 animate-pulse rounded-full",
          mark === "remove" ? "bg-destructive" : "bg-primary"
        )}
      />
      {LABEL[mark]}
    </Badge>
  );
}

const TIMESTAMPS = ["createdAt", "updatedAt", "expiresAt", "revokedAt"] as const;

function revive<T extends object>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const key of TIMESTAMPS) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out as T;
}

/** A previewed trip arrives as JSON; the page's components expect its dates as dates. */
export function reviveTrip(trip: TripWithRelations): TripWithRelations {
  return {
    ...revive(trip),
    items: trip.items.map((i) => ({ ...revive(i), photos: i.photos.map(revive) })),
    photos: trip.photos.map(revive),
    shares: trip.shares.map(revive),
    contributions: trip.contributions.map(revive),
  };
}
