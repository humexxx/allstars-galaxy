"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SavedTeamFilter } from "@/types/sports";

const TeamFilterContext = createContext<SavedTeamFilter | null>(null);

/**
 * The match list on the page and the teams last picked in it, read on the
 * server with the sport (`getSportTeamFilter`), so the list opens on them.
 */
export function SavedTeamFilterProvider({
  filter,
  children,
}: {
  filter: SavedTeamFilter | null;
  children: ReactNode;
}): React.ReactElement {
  return <TeamFilterContext.Provider value={filter}>{children}</TeamFilterContext.Provider>;
}

/** Null outside the hub, or for a list nothing remembers: the filter is then the page's alone. */
export function useSavedTeamFilter(): SavedTeamFilter | null {
  return useContext(TeamFilterContext);
}

export type TeamPicks = {
  picks: readonly string[];
  setPicks: (teamIds: readonly string[]) => void;
  /** Remembers a pick for the next visit, where the list has a saved filter. */
  save: (teamIds: readonly string[]) => void;
};

/** A view's shared picks (`TeamPicksProvider`, `team-picks.tsx`). */
export const TeamPicksContext = createContext<TeamPicks | null>(null);

/**
 * One team picked from anywhere on the view: its fixtures alone, saved as a
 * pick in the list's menu is; the same team again goes back to every team.
 * Null where no match list on the view would follow it.
 */
export function usePickTeam(): { only: (teamId: string) => boolean; pick: (teamId: string) => void } | null {
  const shared = useContext(TeamPicksContext);
  if (!shared) return null;
  const only = (teamId: string): boolean => shared.picks.length === 1 && shared.picks[0] === teamId;
  return {
    only,
    pick: (teamId) => {
      const next = only(teamId) ? [] : [teamId];
      shared.setPicks(next);
      shared.save(next);
    },
  };
}
