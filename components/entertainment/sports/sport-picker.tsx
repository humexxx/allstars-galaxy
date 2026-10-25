"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SPORTS } from "@/lib/data/sports/registry";
import { sportPath } from "@/lib/sports/paths";
import { cn } from "@/lib/utils";
import type { SportId, SportMeta } from "@/types/sports";

import { revealInRow } from "./shared/scroll";

/**
 * Every sport as a button group in two rows, each with its emoji and name, the
 * favourites first and the sport on screen shaded and underlined. On a phone
 * the group runs past the screen's edge and slides sideways, as the old strip
 * of sports did, rather than cutting the names. A sport whose name is
 * shortened ("LoL") gives the full one in a tooltip. Each is a link to the
 * sport's page, so a modified click still opens it in a new tab and Back
 * returns; a plain one is the caller's (`onPick`): the hub's own transition,
 * or, from a tournament's page, the way back to the sport.
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

  // On a phone the sport on screen can sit past its row's edge.
  useEffect(() => {
    const current = group.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const row = current?.closest<HTMLElement>("[data-slot='button-group']");
    if (row) revealInRow(row, current ?? null);
  }, [active]);

  const pick = (event: MouseEvent<HTMLAnchorElement>, sport: SportId): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onPick(sport);
  };

  // Two rows, so eleven sports keep a name row's width; each half in its order.
  const half = Math.ceil(sports.length / 2);
  const rows = [sports.slice(0, half), sports.slice(half)];

  return (
    <div ref={group} role="group" aria-label="Sports" className="flex max-w-full min-w-0 flex-col items-end gap-1">
      {rows.map((row, r) => (
        // Padded inside its scroller and pulled back out, so a focus ring is not clipped.
        <ButtonGroup key={r} role="none" className="no-scrollbar -m-1 max-w-full min-w-0 overflow-x-auto p-1">
          {row.map((sport) => (
            <SportLink
              key={sport.id}
              sport={sport}
              current={sport.id === active}
              favorite={favorites.has(sport.id)}
              onClick={(event) => pick(event, sport.id)}
            />
          ))}
        </ButtonGroup>
      ))}
    </div>
  );
}

/** One sport in the group: its emoji and name, the full name in a tooltip where shortened. */
function SportLink({
  sport,
  current,
  favorite,
  onClick,
}: {
  sport: SportMeta;
  current: boolean;
  favorite: boolean;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}): React.ReactElement {
  const link = (
    <Button
      variant="outline"
      size="sm"
      asChild
      // A bar as well as the shade: the shade alone is 1.18:1, and a hovered
      // sport looks the same. `dark:bg-muted` replaces the variant's
      // `dark:bg-input/30`, which would otherwise win.
      className={cn(
        current
          ? "relative bg-muted text-foreground after:absolute after:inset-x-2 after:bottom-0 after:border-b-2 after:border-primary dark:bg-muted"
          : "text-muted-foreground"
      )}
    >
      <Link
        href={sportPath(sport.id)}
        scroll={false}
        onClick={onClick}
        aria-current={current ? "page" : undefined}
        aria-label={favorite ? `${sport.shortLabel} (favorite)` : sport.shortLabel}
      >
        <span aria-hidden className="text-base leading-none">
          {sport.emoji}
        </span>
        {sport.shortLabel}
      </Link>
    </Button>
  );
  if (sport.label === sport.shortLabel) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent>{sport.label}</TooltipContent>
    </Tooltip>
  );
}

/** Every sport, the favourites first, each group in the registry's order. */
export function favoritesFirst(favorites: ReadonlySet<SportId>): SportMeta[] {
  return [...SPORTS].sort((a, b) => Number(!favorites.has(a.id)) - Number(!favorites.has(b.id)));
}
