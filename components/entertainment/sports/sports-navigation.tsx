"use client";

import { createContext, useContext } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
 * The hub's first row while the route loads: the sport chips, then the
 * favourites button at the end (`loading.tsx`).
 */
export function SportStripSkeleton(): React.ReactElement {
  return (
    <div className="flex items-start gap-2" aria-hidden="true">
      <div className="flex min-w-0 flex-1 gap-2 overflow-hidden pb-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="size-8 shrink-0 rounded-full" />
    </div>
  );
}

/**
 * One sport's page while it loads, laid out as `SportShell` is: the name and
 * the tabs in one bar from `@4xl`, the name above a tabs row narrower, then
 * the overview's two columns — matches on the left, the table beside them.
 * The route's `loading.tsx` uses it too, under the strip.
 */
export function SportSkeleton(): React.ReactElement {
  return (
    <div className="@container flex flex-col" aria-hidden="true">
      <div className="contents @4xl:flex @4xl:h-12 @4xl:items-center @4xl:gap-6 @4xl:border-b">
        <div className="flex items-center gap-3 pb-4 @4xl:gap-2 @4xl:pb-0">
          <Skeleton className="size-12 shrink-0 rounded-xl @4xl:size-8 @4xl:rounded-lg" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-40 sm:h-8 @4xl:h-5 @4xl:w-36" />
            <Skeleton className="h-5 w-56 @4xl:h-3 @4xl:w-28" />
          </div>
        </div>
        <div className="flex h-12 items-end gap-4 border-b pb-2 @4xl:h-auto @4xl:self-stretch @4xl:border-0">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <div className="grid items-start gap-6 pt-6 @4xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-2 @xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-16" />
          <Card size="sm">
            <CardContent className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
