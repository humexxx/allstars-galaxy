"use client";

import { Fragment, type MouseEvent } from "react";
import Link from "next/link";
import { Check, ChevronDown, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SportId, SportMeta } from "@/types/sports";

/**
 * The sport on screen as one long button, and every sport in its menu, the
 * favourites first and starred. Each is a link (`?sport=`), so a modified
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
  /** In the menu's order: the favourites first. */
  sports: SportMeta[];
  favorites: ReadonlySet<SportId>;
  onPick: (sport: SportId) => void;
}): React.ReactElement {
  const current = sports.find((s) => s.id === active);
  const lastFavorite = sports.findLastIndex((s) => favorites.has(s.id));

  const pick = (event: MouseEvent<HTMLAnchorElement>, sport: SportId): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (sport !== active) onPick(sport);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-44 justify-between rounded-full">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-base leading-none">
              {current?.emoji}
            </span>
            <span className="truncate">{current?.shortLabel}</span>
            <span className="sr-only">, change sport</span>
          </span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {sports.map((sport, i) => (
          <Fragment key={sport.id}>
            <DropdownMenuItem asChild>
              <Link
                href={`?sport=${sport.id}`}
                scroll={false}
                onClick={(event) => pick(event, sport.id)}
                aria-current={sport.id === active ? "page" : undefined}
                title={sport.label === sport.shortLabel ? undefined : sport.label}
              >
                <span aria-hidden className="text-base leading-none">
                  {sport.emoji}
                </span>
                <span className="flex-1">{sport.shortLabel}</span>
                {favorites.has(sport.id) && (
                  <>
                    <Star aria-hidden className="size-3 fill-warning text-warning" strokeWidth={2} />
                    <span className="sr-only">(favorite)</span>
                  </>
                )}
                <Check aria-hidden className={sport.id === active ? undefined : "invisible"} />
              </Link>
            </DropdownMenuItem>
            {i === lastFavorite && i < sports.length - 1 && <DropdownMenuSeparator />}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
