"use client";

import { useCallback, useContext, useId, useMemo, useState, useTransition, type ReactNode } from "react";

import { setSportTeamFilterAction } from "@/app/actions/sports";
import { runAction } from "@/lib/actions/run";

import { rememberTeams } from "../seen-sports";
import type { Match } from "@/types/sports";

import { TeamPicksContext, useSavedTeamFilter, type SharedTeamPicks, type TeamPicks } from "./team-filter-context";

function useOwnTeamPicks(): TeamPicks {
  const saved = useSavedTeamFilter();
  const [picks, setPicks] = useState<readonly string[]>(() => saved?.teamIds ?? []);
  const [, startSaving] = useTransition();
  const save = useCallback(
    (teamIds: readonly string[]): void => {
      if (!saved) return;
      startSaving(async () => {
        const result = await runAction(
          setSportTeamFilterAction({ ...saved.list, teamIds: [...teamIds] }),
          { failure: "Couldn't save your teams" }
        );
        if (result.ok) rememberTeams(saved.list, teamIds);
      });
    },
    [saved]
  );
  return useMemo(() => ({ picks, setPicks, save }), [picks, save]);
}

/**
 * The teams picked in a view's match list, shared with whatever else on the
 * view names its teams (the table beside it, the cards in it), so a tap on a
 * team there narrows the list to it. `matches` is the list's own: a team
 * with none of them in it has nothing to narrow to, and stays inert.
 */
export function TeamPicksProvider({
  matches,
  children,
}: {
  matches: readonly Match[];
  children: ReactNode;
}): React.ReactElement {
  const own = useOwnTeamPicks();
  const hintId = useId();
  const filterable = useMemo(
    () => new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])),
    [matches]
  );
  const value = useMemo((): SharedTeamPicks => ({ ...own, filterable, hintId }), [own, filterable, hintId]);
  return (
    <TeamPicksContext.Provider value={value}>
      {children}
      <span id={hintId} hidden>
        Shows only this team&apos;s matches
      </span>
    </TeamPicksContext.Provider>
  );
}

/** The view's picks; a list with no view around it keeps its own. */
export function useTeamPicks(): TeamPicks {
  const shared = useContext(TeamPicksContext);
  const own = useOwnTeamPicks();
  return shared ?? own;
}
