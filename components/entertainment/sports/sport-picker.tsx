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
 * Every sport as one button group, each with its emoji and name, the
 * favourites first and the sport on screen shaded and underlined. Where the
 * row has less room than eleven sports need (beside a long title, on a phone)
 * it slides sideways rather than cutting the names or wrapping. A sport whose name is
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

  // The sport on screen can sit past the row's edge.
  useEffect(() => {
    const row = group.current;
    if (row) revealInRow(row, row.querySelector('[aria-current="page"]'));
  }, [active]);

  const pick = (event: MouseEvent<HTMLAnchorElement>, sport: SportId): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onPick(sport);
  };

  return (
    // Padded inside its scroller and pulled back out, so a focus ring is not clipped.
    <ButtonGroup ref={group} aria-label="Sports" className="no-scrollbar relative -m-1 max-w-full min-w-0 overflow-x-auto p-1">
      {sports.map((sport) => (
        <SportLink
          key={sport.id}
          sport={sport}
          current={sport.id === active}
          favorite={favorites.has(sport.id)}
          onClick={(event) => pick(event, sport.id)}
        />
      ))}
    </ButtonGroup>
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
