import "server-only";

import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { userSportsPreferences } from "@/db/schema";
import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { LOL_DATA } from "@/lib/data/sports/lol";
import { NBA_DATA } from "@/lib/data/sports/nba";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { PADEL_DATA } from "@/lib/data/sports/padel";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { getNbaData } from "@/lib/services/balldontlie-nba-service";
import { getNflData } from "@/lib/services/espn-nfl-service";
import { getFootballLeagueData } from "@/lib/services/football-data-service";
import { getF1CircuitWinner, getF1Data } from "@/lib/services/jolpica-f1-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { getTennisData } from "@/lib/services/espn-tennis-service";
import { leadRace, startsIn, weekendNow } from "@/lib/sports/f1-weekend";
import { formatDayRange } from "@/lib/utils/date";
import type {
  BracketMatch,
  DashboardMatch,
  DashboardSide,
  DashboardSportCard,
  DashboardTable,
  DashboardTableRow,
  F1DashboardHighlight,
  F1Data,
  FootballLeagueData,
  LolChampion,
  LolData,
  LolMatch,
  LolRegion,
  LolSplit,
  Match,
  NbaConference,
  NbaData,
  NflConference,
  NflData,
  RacquetData,
  SportId,
  SwissStage,
  Team,
  UserSportsPreference,
} from "@/types/sports";

// ---------- Favourite CRUD ----------

export async function listUserSportsFavorites(
  userId: string
): Promise<UserSportsPreference[]> {
  return db
    .select()
    .from(userSportsPreferences)
    .where(eq(userSportsPreferences.userId, userId))
    .orderBy(asc(userSportsPreferences.createdAt));
}

/**
 * Request-cached: the dashboard's sports card, its F1 card and the summary
 * builder all ask for the same list during one render.
 */
export const listUserFavoriteSportIds = cache(async function listUserFavoriteSportIds(
  userId: string
): Promise<SportId[]> {
  const rows = await listUserSportsFavorites(userId);
  return rows.map((row) => row.sportId as SportId);
});

export async function setSportFavorite(
  userId: string,
  sportId: SportId,
  isFavorite: boolean
): Promise<void> {
  if (isFavorite) {
    await db
      .insert(userSportsPreferences)
      .values({ userId, sportId })
      .onConflictDoNothing({
        target: [userSportsPreferences.userId, userSportsPreferences.sportId],
      });
    return;
  }
  await db
    .delete(userSportsPreferences)
    .where(
      and(
        eq(userSportsPreferences.userId, userId),
        eq(userSportsPreferences.sportId, sportId)
      )
    );
}

// ---------- Dashboard cards ----------

/** Matches listed under a card's featured one. */
const CARD_MATCHES = 2;
/**
 * LoL lists more: a day of an event is several series back to back, and two
 * did not reach the end of one.
 */
const LOL_CARD_MATCHES = 4;
/** The same, on a LoL card with no table to show. */
const LOL_CARD_MATCHES_ALONE = 6;
/** Rows of a card's table. */
const CARD_ROWS = 5;

const LOL_LEAGUE: Record<LolRegion, string> = {
  worlds: "Worlds",
  msi: "MSI",
  "first-stand": "First Stand",
  lec: "LEC",
  lcs: "LCS",
  lck: "LCK",
  lpl: "LPL",
};

type CardBase = Pick<DashboardSportCard, "sportId" | "label" | "emoji">;

/**
 * One favourite sport's dashboard card, read from the same cached feed as its
 * view.
 *
 * Null for F1, whose card also carries the news (`DashboardF1Card`), and for
 * anything without a card. Football reads the Champions League alone, so the
 * dashboard spends two of football-data's ten requests a minute, not eight.
 */
export async function getDashboardSportCard(sportId: SportId): Promise<DashboardSportCard | null> {
  const meta = SPORTS_BY_ID.get(sportId);
  if (!meta) return null;
  const base: CardBase = { sportId, label: meta.label, emoji: meta.emoji };

  switch (sportId) {
    case "football": {
      const ucl = await getFootballLeagueData("uefa-champions-league");
      return footballCard(base, ucl ?? getFootballLeague("uefa-champions-league"));
    }
    case "nba":
      return nbaCard(base, (await getNbaData()) ?? NBA_DATA);
    case "nfl":
      return nflCard(base, (await getNflData()) ?? NFL_DATA);
    case "lol":
      return lolCard(base, (await getLolData()) ?? LOL_DATA);
    case "tennis": {
      const data = (await getTennisData()) ?? TENNIS_DATA;
      return racquetCard(base, [
        { id: "atp", label: "ATP", data: data.atp },
        { id: "wta", label: "WTA", data: data.wta },
      ]);
    }
    case "padel": {
      const data = (await getPadelData()) ?? PADEL_DATA;
      return racquetCard(base, [
        { id: "men", label: "Men", data: data.men },
        { id: "women", label: "Women", data: data.women },
      ]);
    }
    default:
      return null;
  }
}

/**
 * F1's race for the card that owns it on the dashboard, with its weekend as
 * of this request. The feed is cached; which session is next is worked out
 * here, every time, so it moves on while the feed sits in its cache.
 */
export async function getF1DashboardHighlight(
  now: number = Date.now()
): Promise<F1DashboardHighlight | null> {
  const data = await getF1Data();
  const highlight = f1Highlight(data, now);
  // The sample means Jolpica just failed; asking it again would only hold the
  // card for a second timeout.
  if (!highlight || highlight.race.status === "completed" || data === F1_DATA) return highlight;
  // One race's worth, so not in the season feed: its own call, kept a day.
  const lastYear = await getF1CircuitWinner(data.season - 1, highlight.race.circuitId);
  return lastYear ? { ...highlight, race: { ...highlight.race, lastYear } } : highlight;
}

function footballCard(base: CardBase, data: FootballLeagueData): DashboardSportCard {
  const teams = teamsById(data.teams);
  const { featured, matches } = featuredAndNext(data.matches, teams);
  return {
    ...base,
    context: data.league.name,
    featured,
    matches,
    tables:
      data.standings.length > 0
        ? [
            {
              id: "table",
              label: "Table",
              rows: data.standings
                .slice(0, CARD_ROWS)
                .map((s) => teamRow(s.position, teams.get(s.teamId), s.teamId, `${s.points} pts`)),
            },
          ]
        : [],
  };
}

function nbaCard(base: CardBase, data: NbaData): DashboardSportCard {
  const teams = teamsById(data.teams);
  const { featured, matches } = featuredAndNext(data.games, teams);
  const conference = (id: NbaConference, label: string): DashboardTable => ({
    id,
    label,
    rows: data.standings
      .filter((s) => s.conference === id)
      .sort((a, b) => a.position - b.position)
      .slice(0, CARD_ROWS)
      .map((s) => teamRow(s.position, teams.get(s.teamId), s.teamId, `${s.won}–${s.lost}`)),
  });
  const tables = [conference("east", "East"), conference("west", "West")].filter((t) => t.rows.length > 0);
  return {
    ...base,
    context: `Season ${data.season}`,
    featured,
    matches,
    tables,
    note: tables.length === 0 ? nbaNote(data) : undefined,
  };
}

/** Before the opener there is no table, so who won last season takes its place. */
function nbaNote(data: NbaData): DashboardSportCard["note"] {
  if (!data.tipOff) return undefined;
  const when = { label: "Tips off", startsAt: data.tipOff };
  return data.champion
    ? { title: `${data.champion.season} champions`, text: data.champion.summary, when }
    : { title: "Standings start with the opener", when };
}

function nflCard(base: CardBase, data: NflData): DashboardSportCard {
  const teams = teamsById(data.teams);
  const { featured, matches } = featuredAndNext(data.games, teams);
  const conference = (id: NflConference, label: string): DashboardTable => ({
    id,
    label,
    rows: data.standings
      .filter((s) => s.conference === id)
      .sort((a, b) => a.position - b.position)
      .slice(0, CARD_ROWS)
      .map((s) =>
        teamRow(
          s.position,
          teams.get(s.teamId),
          s.teamId,
          s.ties > 0 ? `${s.wins}–${s.losses}–${s.ties}` : `${s.wins}–${s.losses}`
        )
      ),
  });
  return {
    ...base,
    context: `Season ${data.season}`,
    featured,
    matches,
    tables: [conference("afc", "AFC"), conference("nfc", "NFC")].filter((t) => t.rows.length > 0),
  };
}

/** The first split the feed lists: the international event while it leads, else the split on now. */
function lolCard(base: CardBase, data: LolData): DashboardSportCard {
  const split = data.splits[0];
  if (!split) return { ...base, context: "No event on", matches: [], tables: [] };
  const teams = teamsById(split.teams);
  if (split.international && split.champion) {
    return lolOffSeasonCard(base, data, { ...split, champion: split.champion }, teams);
  }
  // Already in display order: live, then the nearest upcoming, then the
  // latest results. So the cap keeps what is next and fills the rest with
  // what just finished.
  const [first, ...rest] = split.matches.map((m) => lolCardMatch(m, teams));
  const tables = lolTables(split, teams);
  return {
    ...base,
    context: lolContext(split, first),
    featured: first,
    // With no table to show, the matches take its room.
    matches: rest.slice(0, tables.length > 0 ? LOL_CARD_MATCHES : LOL_CARD_MATCHES_ALONE),
    tables,
  };
}

/** "Worlds 2026 · Swiss": the split and the stage its featured match is in. */
function lolContext(split: LolSplit, featured: DashboardMatch | undefined): string {
  return featured?.label ? `${split.name} · ${featured.label.split(" · ")[0]}` : split.name;
}

function lolTables(split: LolSplit, teams: Map<string, Team>): DashboardTable[] {
  if (split.standings.length > 0) {
    return [
      {
        id: "standings",
        label: "Standings",
        rows: split.standings
          .slice(0, CARD_ROWS)
          .map((s) => teamRow(s.position, teams.get(s.teamId), s.teamId, `${s.wins}–${s.losses}`)),
      },
    ];
  }
  // Only while the stage is being played: through the knockouts it was a
  // stale table under "Finals".
  if (split.swiss && !swissFinished(split.swiss)) {
    const records = swissRecords(split.swiss);
    if (records.length > 0) {
      return [
        {
          id: "swiss",
          label: "Swiss stage",
          rows: records
            .slice(0, CARD_ROWS)
            .map((r, i) => teamRow(i + 1, teams.get(r.teamId), r.teamId, `${r.wins}–${r.losses}`)),
        },
      ];
    }
  }
  return [];
}

/** Every record that ends the stage is full: nobody is left to play. */
function swissFinished(stage: SwissStage): boolean {
  return stage.exits.length > 0 && stage.exits.every((exit) => exit.teamIds.length >= exit.slots);
}

/**
 * After an international final, until the next split starts: the final, the
 * rest of the knockouts, and the season's champions.
 */
function lolOffSeasonCard(
  base: CardBase,
  data: LolData,
  event: LolSplit & { champion: LolChampion },
  teams: Map<string, Team>
): DashboardSportCard {
  const knockouts = (event.playoffs ?? [])
    .flatMap((round) => round.matches.map((match) => lolBracketCardMatch(match, round.label, teams)))
    .filter((m) => m !== null)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const featured = knockouts.find((m) => m.id === event.champion.final.id) ?? knockouts[0];
  const champions = lolChampionsTable(data, event);
  return {
    ...base,
    context: lolContext(event, featured),
    featured,
    matches: knockouts
      .filter((m) => m !== featured)
      .slice(0, champions ? LOL_CARD_MATCHES : LOL_CARD_MATCHES_ALONE),
    tables: champions ? [champions] : [],
  };
}

/**
 * The event's champion, then each region's from the same season, in the
 * feed's order. Each is the winner of its round named "Finals" (`findChampion`
 * in the Lolesports service).
 *
 * Only Worlds closes a season. After MSI or First Stand the regions' winners
 * are those of the split before it, which are not the year's champions.
 */
function lolChampionsTable(data: LolData, event: LolSplit): DashboardTable | null {
  const winners = data.splits.flatMap((s) =>
    s.champion && (s.region === event.region || (!s.international && s.season === event.season))
      ? [{ split: s, teamId: s.champion.teamId }]
      : []
  );
  if (winners.length === 0) return null;
  return {
    id: "champions",
    label: event.region === "worlds" ? `${event.season} champions` : "Latest champions",
    unranked: true,
    rows: winners.map(({ split, teamId }, i) =>
      teamRow(i + 1, split.teams.find((t) => t.id === teamId), teamId, LOL_LEAGUE[split.region])
    ),
  };
}

/**
 * Each team's Swiss record so far, best first. Empty until a match has been
 * decided: sixteen teams on 0–0 is not a table.
 */
function swissRecords(stage: SwissStage): { teamId: string; wins: number; losses: number }[] {
  const records = new Map<string, { wins: number; losses: number }>();
  let decided = 0;
  for (const match of stage.rounds.flat().flatMap((pool) => pool.matches)) {
    for (const id of [match.homeTeamId, match.awayTeamId]) {
      if (id && !records.has(id)) records.set(id, { wins: 0, losses: 0 });
    }
    // A live best-of-three already names its leader as the winner; only a
    // finished series moves a record.
    if (match.status !== "ft" || !match.winnerTeamId || !match.homeTeamId || !match.awayTeamId) {
      continue;
    }
    decided++;
    const loser = match.winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    records.get(match.winnerTeamId)!.wins++;
    records.get(loser)!.losses++;
  }
  if (decided === 0) return [];
  return [...records.entries()]
    .map(([teamId, r]) => ({ teamId, ...r }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

function racquetCard(
  base: CardBase,
  tours: { id: string; label: string; data: RacquetData }[]
): DashboardSportCard {
  const tournaments = tours.flatMap((t) => t.data.tournaments);
  const event =
    tournaments.find((t) => t.status === "live") ??
    tournaments
      .filter((t) => t.status === "upcoming")
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return {
    ...base,
    context: event
      ? event.status === "live"
        ? "On now"
        : "Next up"
      : `Season ${tours[0]?.data.season ?? ""}`.trim(),
    event: event
      ? {
          name: event.name,
          detail: [event.location, event.surface, formatDayRange(event.startDate, event.endDate)]
            .filter(Boolean)
            .join(" · "),
          status: event.status,
        }
      : undefined,
    matches: [],
    tables: tours
      .map((t) => ({
        id: t.id,
        label: t.label,
        rows: t.data.rankings.slice(0, CARD_ROWS).map(
          (p): DashboardTableRow => ({
            position: p.position,
            name: p.shortName,
            image: p.photoUrl ? { url: p.photoUrl, kind: "photo" } : undefined,
            flagEmoji: p.flagEmoji,
            value: p.points.toLocaleString("en-US"),
          })
        ),
      }))
      .filter((t) => t.rows.length > 0),
  };
}

function f1Highlight(data: F1Data, now: number): F1DashboardHighlight | null {
  const race = leadRace(data.races);
  if (!race) return null;
  const { live, next } = race.status === "completed" ? {} : weekendNow(race, now);
  return {
    season: data.season,
    race,
    liveSession: live,
    nextSession: next,
    nextSessionIn: next ? startsIn(next.startsAt, now) : undefined,
  };
}

// ---------- Helpers ----------

function teamsById(teams: Team[]): Map<string, Team> {
  return new Map(teams.map((t) => [t.id, t]));
}

function teamRow(position: number, team: Team | undefined, id: string, value: string): DashboardTableRow {
  return {
    position,
    name: team?.shortName ?? id,
    image: team?.logoUrl ? { url: team.logoUrl, kind: "logo" } : undefined,
    code: team?.code,
    color: team?.primaryColor,
    value,
  };
}

const FINISHED = new Set<Match["status"]>(["ft", "aet", "pen"]);

/**
 * The card's featured match and the ones listed under it: whatever else is
 * live, then the next fixtures — or, with nothing ahead, the latest results.
 */
function featuredAndNext(
  all: Match[],
  teams: Map<string, Team>
): { featured?: DashboardMatch; matches: DashboardMatch[] } {
  const featured = pickFeaturedMatch(all);
  if (!featured) return { matches: [] };
  const others = all.filter((m) => m.id !== featured.id);
  const ahead = [
    ...others.filter((m) => m.status === "live"),
    ...others
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
  ];
  const behind = others
    .filter((m) => FINISHED.has(m.status))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  return {
    featured: cardMatch(featured, teams),
    matches: (ahead.length > 0 ? ahead : behind).slice(0, CARD_MATCHES).map((m) => cardMatch(m, teams)),
  };
}

function side(team: Team | undefined, id: string, score: number | null, winner: boolean): DashboardSide {
  return {
    name: team?.shortName ?? id,
    code: team?.code ?? id.slice(0, 3).toUpperCase(),
    logoUrl: team?.logoUrl,
    color: team?.primaryColor,
    score,
    winner,
  };
}

function cardMatch(match: Match, teams: Map<string, Team>): DashboardMatch {
  const started = match.status !== "scheduled";
  const home = started ? match.homeScore : null;
  const away = started ? match.awayScore : null;
  const decided = FINISHED.has(match.status) && home !== null && away !== null;
  // A shoot-out decides a level score; it is kept out of the score itself.
  const homeAhead =
    decided && (home > away || (home === away && (match.penalties?.home ?? 0) > (match.penalties?.away ?? 0)));
  const awayAhead =
    decided && (away > home || (home === away && (match.penalties?.away ?? 0) > (match.penalties?.home ?? 0)));
  return {
    id: match.id,
    home: side(teams.get(match.homeTeamId), match.homeTeamId, home, homeAhead),
    away: side(teams.get(match.awayTeamId), match.awayTeamId, away, awayAhead),
    status: matchTone(match),
    startsAt: match.kickoff,
    label: match.stageLabel,
    minute: match.status === "live" ? match.minute : undefined,
  };
}

function lolCardMatch(match: LolMatch, teams: Map<string, Team>): DashboardMatch {
  const decided = match.status === "ft" && match.homeScore !== null && match.awayScore !== null;
  return {
    id: match.id,
    home: side(
      teams.get(match.homeTeamId),
      match.homeTeamId,
      match.status === "scheduled" ? null : match.homeScore,
      decided && match.homeScore! > match.awayScore!
    ),
    away: side(
      teams.get(match.awayTeamId),
      match.awayTeamId,
      match.status === "scheduled" ? null : match.awayScore,
      decided && match.awayScore! > match.homeScore!
    ),
    status: match.status === "live" ? "live" : match.status === "scheduled" ? "upcoming" : "result",
    startsAt: match.date,
    label: match.stageLabel ? `${match.stageLabel} · BO${match.bestOf}` : `BO${match.bestOf}`,
  };
}

/** A knockout read off the bracket. Null until it is drawn, or when the schedule never dated it. */
function lolBracketCardMatch(
  match: BracketMatch,
  round: string,
  teams: Map<string, Team>
): DashboardMatch | null {
  if (!match.date || !match.homeTeamId || !match.awayTeamId) return null;
  return {
    id: match.id,
    home: side(
      teams.get(match.homeTeamId),
      match.homeTeamId,
      match.homeScore ?? null,
      match.winnerTeamId === match.homeTeamId
    ),
    away: side(
      teams.get(match.awayTeamId),
      match.awayTeamId,
      match.awayScore ?? null,
      match.winnerTeamId === match.awayTeamId
    ),
    status: match.winnerTeamId ? "result" : "upcoming",
    startsAt: match.date,
    label: match.bestOf ? `${round} · BO${match.bestOf}` : round,
  };
}

/**
 * Pick the most "interesting" match to surface: live > next scheduled > most
 * recent finished. Returns null when the list is empty.
 */
function pickFeaturedMatch(matches: Match[]): Match | null {
  const live = matches.find((m) => m.status === "live");
  if (live) return live;
  const upcoming = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  if (upcoming[0]) return upcoming[0];
  const finished = matches
    .filter((m) => FINISHED.has(m.status))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
  return finished[0] ?? matches[0] ?? null;
}

function matchTone(match: Match): DashboardMatch["status"] {
  if (match.status === "live") return "live";
  if (match.status === "scheduled") return "upcoming";
  return "result";
}

/** Pure helpers, exported for their tests. */
export const __testing = { lolCard, swissRecords, f1Highlight };
