"use client";

import { useState, type ReactNode } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * One slot of a dashboard sport card showing one of several things — an
 * event's draw or the tour's rankings — so a card with both is no taller
 * than a card with one. A client island: which view shows is its only state.
 *
 * Every view is laid out in the same grid cell and only the chosen one shown,
 * so the slot is as tall as its tallest view and the card does not change
 * height when the reader switches. The others are `inert`: not seen, not
 * read out, not reachable.
 */
export function DashboardCardSwitch({
  label,
  views,
}: {
  /** What the control chooses between, for a screen reader. */
  label: string;
  views: { id: string; label: string; content: ReactNode }[];
}): React.ReactElement | null {
  const [active, setActive] = useState(views[0]?.id);
  const view = views.find((v) => v.id === active) ?? views[0];
  if (!view) return null;
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup type="single" size="sm" value={view.id} onValueChange={(v) => v && setActive(v)} aria-label={label}>
        {views.map((v) => (
          <ToggleGroupItem key={v.id} value={v.id}>
            {v.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid">
        {views.map((v) => (
          <div
            key={v.id}
            data-view={v.id}
            inert={v.id !== view.id}
            className={cn("col-start-1 row-start-1 min-w-0", v.id !== view.id && "invisible")}
          >
            {v.content}
          </div>
        ))}
      </div>
    </div>
  );
}
