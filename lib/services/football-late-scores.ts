import "server-only";

import type { FootballLeagueId, Match, MatchStatus, Team } from "@/types/sports";

import { fetchHeaderDays, headerMatch, shiftDay, type HeaderEvent } from "./espn-scoreboard";
import { finalStatus, liveClock, shootout, type FootballCompetitor } from "./espn-football-service";

/**
 * football-data's free tier is hours behind on the day's games: on a Sunday
 * evening it still listed that afternoon's LaLiga games as not started, no
 * score. ESPN's scores bar, key-less, has them as they happen. A game
 * football-data still calls scheduled after its kickoff takes its status and
 * score from ESPN; everything else stays football-data's.
 */
const ESPN_LEAGUE: Partial<Record<FootballLeagueId, string>> = {
  "uefa-champions-league": "uefa.champions",
  "la-liga": "esp.1",
  "premier-league": "eng.1",
  "serie-a": "ita.1",
  "ligue-1": "fra.1",
  bundesliga: "ger.1",
  "world-cup": "fifa.world",
};

/** Older than this, a game football-data never settled is not this module's to guess at. */
const LOOKBACK_MS = 3 * 86_400_000;
/** ESPN and football-data agree on a kickoff to the minute; a little slack for a moved one. */
const KICKOFF_SLACK_MS = 15 * 60_000;

const NOISE = new Set(["fc", "cf", "ac", "afc", "sc", "ssc", "as", "rc", "cd", "ud", "sd", "ca", "club", "de", "the", "1."]);

/** "Athletic Club" and "Athletic", "FC Barcelona" and "Barcelona": the words that name the club. */
function words(name: string | undefined): Set<string> {
  const plain = (name ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return new Set(plain.split(/[^a-z0-9.]+/).filter((w) => w.length > 1 && !NOISE.has(w)));
}

function sameClub(team: Team | undefined, espn: { displayName?: string; name?: string; abbreviation?: string } | undefined): boolean {
  if (!team || !espn) return false;
  if (espn.abbreviation && espn.abbreviation.toUpperCase() === team.code.toUpperCase()) return true;
  const theirs = new Set([...words(espn.displayName), ...words(espn.name)]);
  return [...words(team.name), ...words(team.shortName)].some((w) => theirs.has(w));
}

/** The ESPN game a football-data one is: the one kicking off with it, by its clubs when two do. */
function counterpart(match: Match, events: HeaderEvent[], teams: Map<string, Team>): { event: HeaderEvent; swapped: boolean } | null {
  const at = Date.parse(match.kickoff);
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  const near = events.filter((e) => e.date && Math.abs(Date.parse(e.date) - at) <= KICKOFF_SLACK_MS);
  for (const event of near) {
    const mapped = headerMatch(event);
    if (!mapped) continue;
    if (sameClub(home, mapped.home) || sameClub(away, mapped.away)) return { event, swapped: false };
    if (sameClub(home, mapped.away) || sameClub(away, mapped.home)) return { event, swapped: true };
  }
  return near.length === 1 ? { event: near[0], swapped: false } : null;
}

function patched(match: Match, event: HeaderEvent, swapped: boolean): Match {
  const mapped = headerMatch(event);
  if (!mapped || mapped.match.status === "scheduled") return match;
  let status: MatchStatus = mapped.match.status;
  const home: FootballCompetitor = mapped.home;
  const away: FootballCompetitor = mapped.away;
  if (status === "ft") status = finalStatus(event.fullStatus);
  const penalties = status === "pen" ? shootout(home, away) : undefined;
  const flip = <T,>(pair: [T, T]): [T, T] => (swapped ? [pair[1], pair[0]] : pair);
  const [homeScore, awayScore] = flip([mapped.match.homeScore, mapped.match.awayScore]);
  return {
    ...match,
    status,
    homeScore,
    awayScore,
    ...(penalties ? { penalties: swapped ? { home: penalties.away, away: penalties.home } : penalties } : {}),
    ...(status === "live" ? liveClock(event.fullStatus) : {}),
  };
}

/**
 * `matches` with ESPN's word on the games football-data is behind on. One
 * request for the days they fall on, only when there are some; when ESPN
 * fails the games stay as football-data has them.
 */
export async function withLateScores(
  league: FootballLeagueId,
  matches: Match[],
  teams: Map<string, Team>,
  now: number = Date.now()
): Promise<Match[]> {
  const espnLeague = ESPN_LEAGUE[league];
  const behind = matches.filter((m) => {
    const at = Date.parse(m.kickoff);
    return m.status === "scheduled" && at <= now && now - at <= LOOKBACK_MS;
  });
  if (!espnLeague || behind.length === 0) return matches;

  const days = behind.map((m) => m.kickoff.slice(0, 10)).sort();
  // ESPN files a game under its US day: an evening kickoff in UTC can be the
  // day before.
  const events = await fetchHeaderDays({ sport: "soccer", league: espnLeague }, shiftDay(days[0], -1), days.at(-1)!).catch(
    (error: unknown) => {
      console.warn(`espn late scores unavailable for ${league}:`, error);
      return [] as HeaderEvent[];
    }
  );
  if (events.length === 0) return matches;

  const late = new Set(behind);
  return matches.map((m) => {
    if (!late.has(m)) return m;
    const found = counterpart(m, events, teams);
    return found ? patched(m, found.event, found.swapped) : m;
  });
}
