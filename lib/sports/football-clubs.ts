import type { FootballClubMatches, FootballLeagueData, Match, Team } from "@/types/sports";

/** A game's stage led by its competition: "UCL · Matchday 5", or the competition alone. */
export function competitionStage(competition: string, stage: string | undefined): string {
  return stage ? `${competition} · ${stage}` : competition;
}

/**
 * A game listed away from its own competition: its id says which one, so the
 * same game read from that competition again is known as the one already in.
 */
function foreignId(competition: FootballLeagueData, match: Match): string {
  return `${competition.league.id}:${match.id}`;
}

function isForeign(match: Match): boolean {
  return match.id.includes(":");
}

function byProvider(data: FootballLeagueData): Map<string, string> {
  return new Map(Object.entries(data.providerTeamIds ?? {}).map(([id, provider]) => [provider, id]));
}

/**
 * `competition`'s clubs under `home`'s ids: a club both play in keeps the one
 * it has in `home` (found by the provider's number for it, as two feeds may
 * spell it differently), and any other is set apart by the competition, so
 * it can never be taken for one of `home`'s.
 */
function homeIdsFor(home: FootballLeagueData, competition: FootballLeagueData): (id: string) => string {
  if (competition === home) return (id) => id;
  const homeIds = byProvider(home);
  const theirs = competition.providerTeamIds ?? {};
  return (id) => {
    const provider = theirs[id];
    return (provider && homeIds.get(provider)) ?? `${competition.league.id}:${id}`;
  };
}

/** `competition`'s own id for `home`'s club `teamId`, or null when the club is not in it. */
function idIn(home: FootballLeagueData, competition: FootballLeagueData, teamId: string): string | null {
  if (competition === home) return teamId;
  const provider = home.providerTeamIds?.[teamId];
  return provider ? (byProvider(competition).get(provider) ?? null) : null;
}

/**
 * The clubs `teamIds` of `home`, in every competition of `competitions` they
 * play in as well as `home` itself, each game's stage led by its competition.
 * A club is known in another competition by its provider's number, so the
 * competitions must come from the same provider (ESPN's). A game already
 * listed in `home` from one of the others (`withRegionalDerbies`) is read
 * from that one.
 */
export function clubMatchesAcross(
  home: FootballLeagueData,
  competitions: readonly FootballLeagueData[],
  teamIds: readonly string[]
): FootballClubMatches {
  const matches = new Map<string, Match>();
  const teams = new Map<string, Team>();
  for (const competition of [...competitions.filter((c) => c !== home), home]) {
    const own = new Set(teamIds.map((t) => idIn(home, competition, t)).filter((id): id is string => id !== null));
    if (own.size === 0) continue;
    const toHome = homeIdsFor(home, competition);
    const teamsById = new Map(competition.teams.map((t) => [t.id, t]));
    for (const match of competition.matches) {
      if (!own.has(match.homeTeamId) && !own.has(match.awayTeamId)) continue;
      const foreign = competition !== home;
      const id = foreign ? foreignId(competition, match) : match.id;
      if (matches.has(id)) continue;
      const labelled = foreign || !isForeign(match);
      matches.set(id, {
        ...match,
        id,
        homeTeamId: toHome(match.homeTeamId),
        awayTeamId: toHome(match.awayTeamId),
        ...(labelled ? { stageLabel: competitionStage(competition.league.shortName, match.stageLabel) } : {}),
      });
      for (const teamId of [match.homeTeamId, match.awayTeamId]) {
        const team = teamsById.get(teamId);
        const homeId = toHome(teamId);
        if (team && !teams.has(homeId)) teams.set(homeId, { ...team, id: homeId });
      }
    }
  }
  return { teamIds: [...teamIds], teams: [...teams.values()], matches: [...matches.values()] };
}

/** Several clubs' games as one list, each game once. */
export function mergeClubMatches(teamIds: readonly string[], parts: readonly FootballClubMatches[]): FootballClubMatches {
  const matches = new Map<string, Match>();
  const teams = new Map<string, Team>();
  for (const part of parts) {
    for (const m of part.matches) if (!matches.has(m.id)) matches.set(m.id, m);
    for (const t of part.teams) if (!teams.has(t.id)) teams.set(t.id, t);
  }
  return { teamIds: [...teamIds], teams: [...teams.values()], matches: [...matches.values()] };
}

/**
 * `home` with the games two of its own clubs play each other in a regional
 * cup (`cups`), labelled with the cup: Alajuelense and Cartaginés's Central
 * American Cup final is Costa Rica's news as much as Concacaf's. Only games
 * between two of its clubs, so its table and team filter name nobody else.
 * `home` itself when there are none.
 */
export function withRegionalDerbies(home: FootballLeagueData, cups: readonly FootballLeagueData[]): FootballLeagueData {
  const homeIds = byProvider(home);
  const derbies: Match[] = [];
  for (const cup of cups) {
    const theirs = cup.providerTeamIds ?? {};
    const toHome = (id: string): string | undefined => {
      const provider = theirs[id];
      return provider ? homeIds.get(provider) : undefined;
    };
    for (const match of cup.matches) {
      const homeTeamId = toHome(match.homeTeamId);
      const awayTeamId = toHome(match.awayTeamId);
      if (!homeTeamId || !awayTeamId) continue;
      derbies.push({
        ...match,
        id: foreignId(cup, match),
        homeTeamId,
        awayTeamId,
        stageLabel: competitionStage(cup.league.shortName, match.stageLabel),
      });
    }
  }
  if (derbies.length === 0) return home;
  const listed = new Set(home.matches.map((m) => m.id));
  return { ...home, matches: [...home.matches, ...derbies.filter((m) => !listed.has(m.id))] };
}
