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

/**
 * A view's shared picks (`TeamPicksProvider`, `team-picks.tsx`), with the
 * teams its match list can narrow to and the id of the line that says what a
 * tap on one does.
 */
export type SharedTeamPicks = TeamPicks & {
  filterable: ReadonlySet<string>;
  hintId: string;
};

export const TeamPicksContext = createContext<SharedTeamPicks | null>(null);

export type PickTeam = {
  /** Whether the list has any of this team's games to narrow to. */
  can: (teamId: string) => boolean;
  only: (teamId: string) => boolean;
  pick: (teamId: string) => void;
  hintId: string;
};

/**
 * One team picked from anywhere on the view: its fixtures alone, saved as a
 * pick in the list's menu is; the same team again goes back to every team.
 * Only a team with a game in the list can be picked, and a remembered pick
 * the list has let go (a club knocked out) counts for nothing, so what reads
 * as pressed is what the list shows. Null where no match list on the view
 * would follow it.
 */
export function usePickTeam(): PickTeam | null {
  const shared = useContext(TeamPicksContext);
  if (!shared) return null;
  const { filterable, picks } = shared;
  const effective = picks.filter((id) => filterable.has(id));
  const only = (teamId: string): boolean => effective.length === 1 && effective[0] === teamId;
  return {
    can: (teamId) => filterable.has(teamId),
    only,
    pick: (teamId) => {
      const next = only(teamId) ? [] : [teamId];
      shared.setPicks(next);
      shared.save(next);
    },
    hintId: shared.hintId,
  };
}
