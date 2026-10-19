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
 * One sport's page while it loads: the shell's header, its tabs, and the
 * overview's two columns — matches on the left, the table beside them. The
 * route's `loading.tsx` uses it too, under the strip.
 */
export function SportSkeleton() {
  return (
    <div className="@container flex flex-col gap-6" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-7 w-40 sm:h-8" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid items-start gap-6 @4xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-2 @xl:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Card size="sm">
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
