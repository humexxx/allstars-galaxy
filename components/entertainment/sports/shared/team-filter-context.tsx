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
