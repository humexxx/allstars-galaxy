"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SportId, SportMeta } from "@/types/sports";

import { revealInRow } from "./shared/scroll";

/**
 * Every sport as one button group, each with its emoji and name, the
 * favourites first and the sport on screen shaded. On a phone the group runs
 * past the screen's edge and slides sideways, as the old strip of sports did,
 * rather than cutting the names. A sport whose name is shortened ("LoL")
 * gives the full one in a tooltip. Each is a link (`?sport=`), so a modified
 * click still opens it in a new tab and Back returns; a plain one goes
 * through the hub's own transition (`onPick`).
 */
export function SportPicker({
  active,
  sports,
  favorites,
  onPick,
}: {
  active: SportId;
  /** In the group's order: the favourites first. */
  sports: SportMeta[];
  favorites: ReadonlySet<SportId>;
  onPick: (sport: SportId) => void;
}): React.ReactElement {
  const group = useRef<HTMLDivElement>(null);

  // On a phone the sport on screen can sit past the group's edge.
  useEffect(() => {
    const row = group.current;
    if (row) revealInRow(row, row.querySelector('[aria-current="page"]'));
  }, [active]);

  const pick = (event: MouseEvent<HTMLAnchorElement>, sport: SportId): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (sport !== active) onPick(sport);
  };

  return (
    // Padded inside its scroller and pulled back out, so a focus ring is not clipped.
    <ButtonGroup ref={group} aria-label="Sports" className="no-scrollbar -m-1 max-w-full min-w-0 overflow-x-auto p-1">
      {sports.map((sport) => {
        const current = sport.id === active;
        const link = (
          <Button
            key={sport.id}
            variant="outline"
            size="sm"
            asChild
            className={cn(current ? "bg-muted text-foreground" : "text-muted-foreground")}
          >
            <Link
              href={`?sport=${sport.id}`}
              scroll={false}
              onClick={(event) => pick(event, sport.id)}
              aria-current={current ? "page" : undefined}
              aria-label={favorites.has(sport.id) ? `${sport.shortLabel} (favorite)` : sport.shortLabel}
            >
              <span aria-hidden className="text-base leading-none">
                {sport.emoji}
              </span>
              {sport.shortLabel}
            </Link>
          </Button>
        );
        return sport.label === sport.shortLabel ? (
          link
        ) : (
          <Tooltip key={sport.id}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent>{sport.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ButtonGroup>
  );
}
