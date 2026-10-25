"use client";

import { createContext, useContext } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SportId } from "@/types/sports";

import { SportHubControls } from "./shared/sport-shell";

/**
 * Moves the hub to another sport or league inside the hub's own transition,
 * so the hub can show what is coming (`SportSkeleton`) instead of a spinner
 * beside the control that was used.
 */
export const SportsNavigationContext = createContext<(href: string) => void>(() => {});

export function useSportsNavigation(): (href: string) => void {
  return useContext(SportsNavigationContext);
}

/**
 * `SportShell`'s two rows while a page loads: the name row (tile, title,
 * subtitle) and the tabs over their rule. Inside the hub the name row ends on
 * the hub's own favourites and sport picker, usable while the page loads; a
 * route's `loading.tsx` has no hub, so it draws their places.
 */
export function ShellHeadSkeleton({ title = "w-44" }: { title?: "w-44" | "w-72" } = {}): React.ReactElement {
  const hubControls = useContext(SportHubControls);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <div className="flex min-w-0 items-center gap-3" aria-hidden="true">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className={cn("h-6 max-w-full", title)} />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        {hubControls ? (
          <div className="flex max-w-full min-w-0 items-center gap-2">{hubControls}</div>
        ) : (
          <div className="flex items-center gap-2" aria-hidden="true">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-8 w-112 max-w-full rounded-md" />
          </div>
        )}
      </div>
      <div className="flex h-12 items-end gap-4 border-b pb-2" aria-hidden="true">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    </>
  );
}

/** What the left of a sport's Overview holds, for its skeleton. */
type Shape = "matches" | "events";

/** F1, padel and tennis lead with one event, big, and the ones after it as tiles. */
const SHAPES: Partial<Record<SportId, Shape>> = {
  f1: "events",
  padel: "events",
  tennis: "events",
  surf: "events",
};

/**
 * One sport's page while it loads, laid out as `SportShell` is — the name
 * row, the tabs over their rule — then the Overview's two columns: the left
 * as the sport fills it (days of match cards; or, for F1, padel and tennis,
 * the event on now or next and the ones after it), each part under a line
 * set like a day heading, and beside it the table's label and card: its ten rows
 * and the "Show more" line under them, as every table in the hub. Inside
 * the hub the name row ends on the hub's own favourites and sport picker,
 * usable while the sport loads; the route's `loading.tsx` has no hub, and no
 * sport to go by, so it draws their places.
 */
export function SportSkeleton({ sport }: { sport?: SportId } = {}): React.ReactElement {
  const shape = (sport && SHAPES[sport]) ?? "matches";
  return (
    <div className="@container flex flex-col">
      <ShellHeadSkeleton />
      <div className="grid items-start gap-6 pt-6 @4xl:grid-cols-[2fr_1fr]" aria-hidden="true">
        <div className="flex min-w-0 flex-col gap-6">
          {shape === "events" ? <EventsSkeleton /> : <MatchesSkeleton />}
        </div>
        <div className="flex flex-col gap-2">
          <HeadingLine className="w-20" />
          <TableSkeleton withToggle={sport === "f1"} />
        </div>
      </div>
    </div>
  );
}

/** A day heading's line: 22px, as `Eyebrow size="sm"` with `py-1`. */
function HeadingLine({ className }: { className?: string }): React.ReactElement {
  return (
    <div className="flex h-5.5 items-center">
      <Skeleton className={cn("h-3 w-40", className)} />
    </div>
  );
}

function MatchesSkeleton(): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <HeadingLine className="w-48" />
      <div className="grid gap-2 @xl:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

/** The event on now or next as a card, then the ones after it as tiles. */
function EventsSkeleton(): React.ReactElement {
  return (
    <>
      <section className="flex flex-col gap-2">
        <HeadingLine className="w-24" />
        <Card>
          <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="size-20 @2xl:size-40" />
            <div className="col-span-2 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="flex flex-col gap-2">
        <HeadingLine className="w-24" />
        <div className="grid gap-3 @xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </section>
    </>
  );
}

/** A table card: its header band, ten rows and the "Show more" line. */
function TableSkeleton({ withToggle }: { withToggle: boolean }): React.ReactElement {
  return (
    <Card className="gap-0 py-0">
      {withToggle && (
        <div className="flex h-14 items-center border-b px-3">
          <Skeleton className="h-8 w-44" />
        </div>
      )}
      <div className="flex h-10 items-center border-b bg-muted/40 px-3">
        <Skeleton className="h-3 w-full" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center gap-3 border-b px-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-8" />
        </div>
      ))}
      <div className="flex h-10 items-center justify-center">
        <Skeleton className="h-3.5 w-24" />
      </div>
    </Card>
  );
}
