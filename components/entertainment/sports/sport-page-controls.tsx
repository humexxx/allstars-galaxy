"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { sportPath } from "@/lib/sports/paths";
import type { SportId } from "@/types/sports";

import { ManageFavoritesSheet } from "./manage-favorites-sheet";
import { SportHubControls } from "./shared/sport-shell";
import { favoritesFirst, SportPicker } from "./sport-picker";

/**
 * The hub's favourites button and sport picker, for a page under it (a
 * tournament's): its name row ends on them just as the sport's does, so
 * opening a tournament changes nothing but the title and the tabs. A sport
 * picked here, its own included, goes to that sport's page.
 */
export function SportPageControls({
  sport,
  favoriteSportIds,
  children,
}: {
  sport: SportId;
  favoriteSportIds: SportId[];
  children: ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const favorites = useMemo(() => new Set(favoriteSportIds), [favoriteSportIds]);
  return (
    <SportHubControls.Provider
      value={
        <>
          <ManageFavoritesSheet favoriteSportIds={favoriteSportIds} trigger="icon" />
          <SportPicker
            active={sport}
            sports={favoritesFirst(favorites)}
            favorites={favorites}
            onPick={(picked) => router.push(sportPath(picked))}
          />
        </>
      }
    >
      {children}
    </SportHubControls.Provider>
  );
}
