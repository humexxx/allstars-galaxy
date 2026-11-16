import "server-only";

import { cache } from "react";
import { and, asc, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { userSportsPreferences, userSportsTeamFilters } from "@/db/schema";
import { F1_DATA } from "@/lib/data/sports/f1";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { getNbaData } from "@/lib/services/balldontlie-nba-service";
import { getMlbData } from "@/lib/services/espn-mlb-service";
import { getEspnNews } from "@/lib/services/espn-news-service";
import { getPadelNews } from "@/lib/services/premier-padel-news-service";
import { getSurfNews } from "@/lib/services/stab-surf-news-service";
import { getSurfData } from "@/lib/services/wsl-surf-service";
import { getNflData } from "@/lib/services/espn-nfl-service";
import { getNhlData } from "@/lib/services/espn-nhl-service";
import { FOOTBALL_COMPETITIONS, getFootballCompetition } from "@/lib/services/football-service";
import { getF1Data, getF1SeasonWinners } from "@/lib/services/jolpica-f1-service";
import { getLolNews } from "@/lib/services/lolesports-news-service";
import { getLolData } from "@/lib/services/lolesports-service";
import { getPadelData, getPadelDraw } from "@/lib/services/padel-api-service";
import { getTennisData, getTennisDraw } from "@/lib/services/espn-tennis-service";
import { leadRace, startsIn, weekendNow } from "@/lib/sports/f1-weekend";
import { tournamentPath } from "@/lib/sports/paths";
import { splitSeasonLabel } from "@/lib/sports/season";
import { calendarDayInTimeZone, formatDay, formatDayRange } from "@/lib/utils/date";
import { topSeeds } from "@/lib/sports/racquet";
import type {
  BracketRound,
  DashboardBracket,
  DashboardBracketSide,
  DashboardCompetitions,
  DashboardMatch,
  DashboardSide,
  DashboardSportCard,
  DashboardSwiss,
  DashboardTable,
  DashboardTableRow,
  DashboardTeam,
  F1DashboardHighlight,
  F1Data,
  FavoriteSport,
  FootballLeagueData,
  FootballLeagueId,
  LolChampion,
  LolData,
  LolMatch,
  LolRegion,
  NewsStory,
  LolSplit,
  Match,
  MlbData,
  NbaData,
  NflData,
  NhlData,
  PlayerRanking,
  RacquetData,
  RacquetDraw,
  RacquetSport,
  SurfData,
  SurfDraw,
  SportId,
  Standing,
  SwissStage,
  Team,
  TeamFilterList,
  UserSportsPreference,
  UserSportsTeamFilter,
} from "@/types/sports";
import {
  FOOTBALL_COMPETITION_IDS,
  LOL_REGIONS,
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
 * Request-cached: the dashboard's sport cards and its F1 card ask for the same
 * rows during one render.
 */
export const listUserFavoriteSports = cache(async function listUserFavoriteSports(
  userId: string
): Promise<FavoriteSport[]> {
  const rows = await listUserSportsFavorites(userId);
  return rows.map((row) => ({ sportId: row.sportId as SportId, competition: row.competition }));
});

export const listUserFavoriteSportIds = cache(async function listUserFavoriteSportIds(
  userId: string
): Promise<SportId[]> {
  const favorites = await listUserFavoriteSports(userId);
  return favorites.map((favorite) => favorite.sportId);
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

/**
 * Sets the championship a favourite's dashboard card shows (null: the card's
 * own pick). Only the caller's own favourite row is touched; null when the
 * sport is not one of their favourites, since a card exists only for those.
 */
export async function setSportCompetition(
  userId: string,
  sportId: SportId,
  competition: string | null
): Promise<UserSportsPreference | null> {
  const [row] = await db
    .update(userSportsPreferences)
    .set({ competition })
    .where(
      and(
        eq(userSportsPreferences.userId, userId),
        eq(userSportsPreferences.sportId, sportId)
      )
    )
    .returning();
  return row ?? null;
}

// ---------- Team filters ----------

const sameList = (userId: string, list: TeamFilterList): SQL | undefined =>
  and(
    eq(userSportsTeamFilters.userId, userId),
    eq(userSportsTeamFilters.sportId, list.sportId),
    eq(userSportsTeamFilters.competition, list.competition)
  );

/** The teams the caller last narrowed this match list to; [] for every team. */
export async function getSportTeamFilter(
  userId: string,
  list: TeamFilterList
): Promise<string[]> {
  const [row] = await db
    .select({ teamIds: userSportsTeamFilters.teamIds })
    .from(userSportsTeamFilters)
    .where(sameList(userId, list))
    .limit(1);
  return row?.teamIds ?? [];
}

/**
 * Remembers the teams the caller narrowed a match list to, once each, in the
 * order picked. Every team (an empty list) deletes the row instead: no row
 * already means that. Null when there was nothing to keep.
 */
export async function setSportTeamFilter(
  userId: string,
  list: TeamFilterList,
  teamIds: readonly string[]
): Promise<UserSportsTeamFilter | null> {
  const unique = [...new Set(teamIds)];
  if (unique.length === 0) {
    await db.delete(userSportsTeamFilters).where(sameList(userId, list));
    return null;
  }
  const [row] = await db
    .insert(userSportsTeamFilters)
    .values({ userId, sportId: list.sportId, competition: list.competition, teamIds: unique })
    .onConflictDoUpdate({
      target: [
        userSportsTeamFilters.userId,
        userSportsTeamFilters.sportId,
        userSportsTeamFilters.competition,
      ],
      set: { teamIds: unique, updatedAt: new Date() },
    })
    .returning();
  return row ?? null;
}

// ---------- Dashboard cards ----------

/** Games in a card's lead box, played and to come. */
const CARD_SLIDES = 5;
/** Of them, the most of yesterday's and today's results… */
const CARD_RECENT = 3;
/** …and the fewest still to come, when there are some. */
const CARD_UPCOMING = 2;
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

/** Football's card with nothing chosen. */
const DEFAULT_FOOTBALL: FootballLeagueId = "uefa-champions-league";
const LOL_AUTOMATIC = "Follow what's on";

type CardBase = Pick<DashboardSportCard, "sportId" | "label" | "emoji">;

/** The reader's zone and the moment, for "yesterday" and "today" on their calendar. */
type CardClock = { timeZone: string; now: number };

function utcClock(): CardClock {
  return { timeZone: "UTC", now: Date.now() };
}

/**
 * One favourite sport's dashboard card, read from the same cached feed as its
 * view, for the championship it is set to (`competition`, null for the
 * card's own pick).
 *
 * Null for F1, whose card also carries the news (`DashboardF1Card`), and for
 * anything without a card. Football reads the one league the card shows, so
 * the dashboard spends two of football-data's ten requests a minute, not
 * eight. A stored choice the sport no longer offers (a league dropped, a LoL
 * event over) falls back to the card's own pick rather than failing it.
 */
export async function getDashboardSportCard(
  sportId: SportId,
  competition: string | null = null,
  timeZone = "UTC"
): Promise<DashboardSportCard | null> {
  const meta = SPORTS_BY_ID.get(sportId);
  if (!meta) return null;
  const base: CardBase = { sportId, label: meta.label, emoji: meta.emoji };
  const clock: CardClock = { timeZone, now: Date.now() };

  switch (sportId) {
    case "football": {
      const id = oneOf(FOOTBALL_COMPETITION_IDS, competition) ?? DEFAULT_FOOTBALL;
      // Each competition from the feed that has it; the news is ESPN's, and
      // costs football-data nothing.
      const [data, news] = await Promise.all([getFootballCompetition(id), getEspnNews(id)]);
      return {
        ...footballCard(base, data, clock),
        news: cardNews(news),
        competitions: {
          value: id,
          options: FOOTBALL_COMPETITIONS.map((c) => ({ id: c.id, label: c.name })),
        },
      };
    }
    case "nba": {
      const [data, news] = await Promise.all([getNbaData(), getEspnNews("nba")]);
      return { ...nbaCard(base, data, clock), news: cardNews(news) };
    }
    case "nfl": {
      const [data, news] = await Promise.all([getNflData(), getEspnNews("nfl")]);
      return { ...nflCard(base, data, clock), news: cardNews(news) };
    }
    case "mlb": {
      const [data, news] = await Promise.all([getMlbData(), getEspnNews("mlb")]);
      return { ...mlbCard(base, data, clock), news: cardNews(news) };
    }
    case "nhl": {
      const [data, news] = await Promise.all([getNhlData(), getEspnNews("nhl")]);
      return { ...nhlCard(base, data, clock), news: cardNews(news) };
    }
    case "lol": {
      const [data, news] = await Promise.all([getLolData(), getLolNews()]);
      return { ...lolCard(base, data, oneOf(LOL_REGIONS, competition), clock), news: cardNews(news) };
    }
    case "tennis": {
      const [data, news] = await Promise.all([getTennisData(), getEspnNews("atp")]);
      const draw = await leadDraw(data.atp, clock, getTennisDraw);
      return { ...racquetCard({ ...base, sportId: "tennis" }, data.atp, "ATP", clock, draw), news: cardNews(news) };
    }
    case "padel": {
      const [data, news] = await Promise.all([getPadelData(), getPadelNews()]);
      const draw = await leadDraw(data.men, clock, getPadelDraw);
      return {
        ...racquetCard({ ...base, sportId: "padel" }, data.men, "Premier Padel", clock, draw),
        news: cardNews(news),
      };
    }
    case "surf": {
      const [data, news] = await Promise.all([getSurfData(), getSurfNews()]);
      return { ...surfCard(base, data, clock), news: cardNews(news) };
    }
    default:
      return null;
  }
}

/** How many stories a card's rail carries. */
const CARD_NEWS = 6;

/**
 * A card's latest news: its stories and recaps, newest first — a clip's page
 * is a video player, not something to read off a dashboard.
 */
function cardNews(stories: NewsStory[]): NewsStory[] {
  return stories.filter((s) => s.kind !== "video").slice(0, CARD_NEWS);
}

/** `value` when it is one of `choices`, else null. */
function oneOf<T extends string>(choices: readonly T[], value: string | null): T | null {
  return choices.find((choice) => choice === value) ?? null;
}

/**
 * F1's race for the card that owns it on the dashboard, with its weekend as
 * of this request. The feed is cached; which race leads and which session is
 * next are worked out here, every time, so they move on while the feed sits
 * in its cache.
 */
export async function getF1DashboardHighlight(
  now?: number,
  timeZone = "UTC"
): Promise<F1DashboardHighlight | null> {
  now ??= Date.now();
  // A season is a calendar year, so last season's winners can be asked for
  // alongside the feed rather than after it, which held the card for a
  // second timeout on a cold cache.
  const lastSeason = new Date(now).getUTCFullYear() - 1;
  const [data, winners] = await Promise.all([getF1Data(now), getF1SeasonWinners(lastSeason)]);
  const highlight = f1Highlight(data, now, timeZone);
  // The sample is not a season anybody raced, so nobody won there last year.
  if (!highlight || highlight.race.status === "completed" || data === F1_DATA) return highlight;
  // Only around the new year can the feed's season and the calendar's differ.
  const pastWinners =
    data.season - 1 === lastSeason ? winners : await getF1SeasonWinners(data.season - 1);
  const lastYear = pastWinners[highlight.race.circuitId];
  return lastYear ? { ...highlight, race: { ...highlight.race, lastYear } } : highlight;
}

/**
 * A league's top five, or each conference's for one played in two (MLS),
 * as a toggle. A World Cup group is not a conference: twelve of them would be
 * a dozen toggles, so its card has none.
 */
function footballCard(base: CardBase, data: FootballLeagueData, clock: CardClock = utcClock()): DashboardSportCard {
  const teams = teamsById(data.teams);
  const table = (id: string, label: string, standings: Standing[]): DashboardTable => ({
    id,
    label,
    rows: standings
      .slice(0, CARD_ROWS)
      .map((s) => teamRow(s.position, teams.get(s.teamId), s.teamId, `${s.points} pts`)),
  });
  const conferences = data.league.id === "world-cup" ? [] : (data.groups ?? []);
  const tables =
    conferences.length > 1
      ? conferences.map((g) => table(g.label.toLowerCase(), g.label, g.standings))
      : data.standings.length > 0
        ? [table("table", "Table", data.standings)]
        : [];
  return {
    ...base,
    context: data.league.name,
    ...featuredAndFollowing(data.matches, teams, clock),
    tables,
    // From the quarter-finals on, beside the table (or the groups) it came out of.
    bracket: teamBracket(`${data.league.name} knockout`, data.knockout, teams),
  };
}

/**
 * One table per group (a conference, a league), its first `CARD_ROWS` teams
 * by position; a group with nobody in it is left out.
 */
function groupTables<S extends { position: number; teamId: string }, G extends string>(
  standings: S[],
  teams: Map<string, Team>,
  groupOf: (s: S) => G,
  groups: ReadonlyArray<{ id: NoInfer<G>; label: string }>,
  record: (s: S) => string
): DashboardTable[] {
  return groups
    .map(({ id, label }) => ({
      id,
      label,
      rows: standings
        .filter((s) => groupOf(s) === id)
        .sort((a, b) => a.position - b.position)
        .slice(0, CARD_ROWS)
        .map((s) => teamRow(s.position, teams.get(s.teamId), s.teamId, record(s))),
    }))
    .filter((t) => t.rows.length > 0);
}

function nbaCard(base: CardBase, data: NbaData, clock: CardClock = utcClock()): DashboardSportCard {
  const teams = teamsById(data.teams);
  const tables = groupTables(
    data.standings,
    teams,
    (s) => s.conference,
    [
      { id: "east", label: "East" },
      { id: "west", label: "West" },
    ],
    (s) => `${s.won}–${s.lost}`
  );
  return {
    ...base,
    context: `Season ${data.season}`,
    ...leadOrChampion(data.games, data.playoffs, teams, clock),
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

function nflCard(base: CardBase, data: NflData, clock: CardClock = utcClock()): DashboardSportCard {
  const teams = teamsById(data.teams);
  return {
    ...base,
    context: `Season ${data.season}`,
    ...leadOrChampion(data.games, data.playoffs, teams, clock),
    tables: groupTables(
      data.standings,
      teams,
      (s) => s.conference,
      [
        { id: "afc", label: "AFC" },
        { id: "nfc", label: "NFC" },
      ],
      (s) => (s.ties > 0 ? `${s.wins}–${s.losses}–${s.ties}` : `${s.wins}–${s.losses}`)
    ),
  };
}

function mlbCard(base: CardBase, data: MlbData, clock: CardClock = utcClock()): DashboardSportCard {
  const teams = teamsById(data.teams);
  return {
    ...base,
    context: `Season ${data.season}`,
    ...leadOrChampion(data.games, data.playoffs, teams, clock),
    tables: groupTables(
      data.standings,
      teams,
      (s) => s.league,
      [
        { id: "al", label: "American League" },
        { id: "nl", label: "National League" },
      ],
      (s) => `${s.wins}–${s.losses}`
    ),
  };
}

/** Each conference by points, the hockey table's own order. */
function nhlCard(base: CardBase, data: NhlData, clock: CardClock = utcClock()): DashboardSportCard {
  const teams = teamsById(data.teams);
  return {
    ...base,
    context: `Season ${splitSeasonLabel(data.season)}`,
    ...leadOrChampion(data.games, data.playoffs, teams, clock),
    tables: groupTables(
      data.standings,
      teams,
      (s) => s.conference,
      [
        { id: "east", label: "Eastern" },
        { id: "west", label: "Western" },
      ],
      (s) => `${s.points} pts`
    ),
  };
}

/**
 * The split the card is set to, or with none chosen (or one no longer in the
 * feed) the first the feed lists: the international event while it leads,
 * else the split on now.
 */
function lolCard(
  base: CardBase,
  data: LolData,
  region: LolRegion | null = null,
  clock: CardClock = utcClock()
): DashboardSportCard {
  const chosen = region ? data.splits.find((s) => s.region === region) : undefined;
  const competitions: DashboardCompetitions = {
    value: chosen ? chosen.region : null,
    automatic: LOL_AUTOMATIC,
    options: data.splits.map((s) => ({ id: s.region, label: s.name })),
    waiting: region && !chosen ? { id: region, label: LOL_LEAGUE[region] } : undefined,
  };
  return { ...lolSplitCard(base, data, chosen ?? data.splits[0], clock), competitions };
}

function lolSplitCard(base: CardBase, data: LolData, split: LolSplit | undefined, clock: CardClock): DashboardSportCard {
  if (!split) return { ...base, context: "No event on", matches: [], tables: [] };
  const teams = teamsById(split.teams);
  if (split.international && split.champion) {
    return lolOffSeasonCard(base, data, { ...split, champion: split.champion }, teams, clock);
  }
  const lead = leadGames(
    split.matches.filter((m) => m.status !== "postponed" && m.status !== "cancelled").map((m) => lolCardMatch(m, teams)),
    clock
  );
  const swiss = lolSwiss(split, teams);
  return {
    ...base,
    context: lolContext(split, focusOf([lead.featured, ...(lead.following ?? [])].filter((m) => m !== undefined))),
    ...lead,
    matches: [],
    tables: swiss ? [] : lolTables(split, teams),
    swiss,
    // Once the knockouts are down to a card's size, while they are played.
    bracket: swiss ? undefined : lolBracket(split, teams),
  };
}

/** The game that says where an event stands: what is live, else what is next, else the latest. */
function focusOf(games: DashboardMatch[]): DashboardMatch | undefined {
  return games.find((g) => g.status === "live") ?? games.find((g) => g.status === "upcoming") ?? games.at(-1);
}

/** "Worlds 2026 · Swiss": the split and the stage its focus is in. */
function lolContext(split: LolSplit, featured: DashboardMatch | undefined): string {
  return featured?.label ? `${split.name} · ${featured.label.split(" · ")[0]}` : split.name;
}

function lolTables(split: LolSplit, teams: Map<string, Team>): DashboardTable[] {
  if (split.standings.length === 0) return [];
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

/**
 * Where the Swiss stage stands, only while it is played: through the
 * knockouts it was a stale picture under "Finals". Those through and those
 * out each take one row, whatever their record, so it never runs past four.
 */
function lolSwiss(split: LolSplit, teams: Map<string, Team>): DashboardSwiss | undefined {
  const stage = split.swiss;
  if (!stage || swissFinished(stage)) return undefined;
  const records = swissRecords(stage);
  if (records.length === 0) return undefined;
  const team = (id: string): DashboardTeam => {
    const { name, image, code, color } = teamRow(0, teams.get(id), id, "");
    return { name, image, code, color };
  };
  const through = records.filter((r) => r.wins >= stage.winsToAdvance);
  const out = records.filter((r) => r.losses >= stage.lossesToExit);
  const playing = records.filter((r) => r.wins < stage.winsToAdvance && r.losses < stage.lossesToExit);
  const byRecord = new Map<string, typeof playing>();
  for (const r of playing) {
    const key = `${r.wins}–${r.losses}`;
    byRecord.set(key, [...(byRecord.get(key) ?? []), r]);
  }
  const pools: DashboardSwiss["pools"] = [
    ...(through.length > 0 ? [{ label: "Through", outcome: "through" as const, teams: through.map((r) => team(r.teamId)) }] : []),
    ...[...byRecord].map(([label, rs]) => ({ label, teams: rs.map((r) => team(r.teamId)) })),
    ...(out.length > 0 ? [{ label: "Out", outcome: "out" as const, teams: out.map((r) => team(r.teamId)) }] : []),
  ];
  return { pools };
}

/** Every record that ends the stage is full: nobody is left to play. */
function swissFinished(stage: SwissStage): boolean {
  return stage.exits.length > 0 && stage.exits.every((exit) => exit.teamIds.length >= exit.slots);
}

/** How long a decided event still reads as "Just finished" on its card. */
const JUST_FINISHED_MS = 14 * 86_400_000;

/**
 * After an international final, until the next split starts: the event with
 * its champion and the final's score, the way a padel or tennis card leads
 * with the tournament just won — the knockouts are a week old by then and
 * live on the event's own page. Under it, what comes next, then the season's
 * champions.
 */
function lolOffSeasonCard(
  base: CardBase,
  data: LolData,
  event: LolSplit & { champion: LolChampion },
  teams: Map<string, Team>,
  clock: CardClock
): DashboardSportCard {
  const { final, teamId } = event.champion;
  const beatenId = final.homeTeamId === teamId ? final.awayTeamId : final.homeTeamId;
  const games = [final.homeScore, final.awayScore].filter((n) => n != null).sort((x, y) => y - x);
  const round = (event.playoffs ?? []).find((r) => r.matches.some((m) => m.id === final.id))?.label;
  const recent = final.date !== undefined && clock.now - new Date(final.date).getTime() < JUST_FINISHED_MS;
  const comingUp = lolComingUp(data);
  const bracket = lolBracket(event, teams);
  // The bracket says who won and how; the champions' list stands in only for an event with none.
  const champions = bracket ? null : lolChampionsTable(data, event);
  return {
    ...base,
    context: round ? `${event.name} · ${round}` : event.name,
    event: {
      name: event.name,
      detail: [round, final.bestOf && `BO${final.bestOf}`, final.date && formatDay(final.date, clock.timeZone)]
        .filter(Boolean)
        .join(" · "),
      status: "completed",
      label: recent ? undefined : "Latest event",
      winner: teams.get(teamId)?.shortName ?? teamId,
      winnerFace: teams.get(teamId),
      // The code, not the name: "def. Gen.G Esports 3–1" lost its score on a phone.
      runnerUp: beatenId ? (teams.get(beatenId)?.code ?? beatenId) : undefined,
      score: games.length === 2 ? `${games[0]}–${games[1]}` : undefined,
    },
    matches: [],
    tables: [comingUp, champions].filter((t) => t !== null),
    bracket,
  };
}

/** How many rounds a card's bracket has room for: the last ones, down to the final. */
const BRACKET_ROUNDS = 3;
/**
 * And how many ties a round may have: the quarter-finals' four. An event in
 * its round of 32 has no bracket on the card — a column of sixteen ties made
 * the card, and the one beside it, several screens tall.
 */
const BRACKET_TIES = 4;
const fitsCard = (round: { ties: unknown[] }): boolean => round.ties.length > 0 && round.ties.length <= BRACKET_TIES;

/**
 * The round a knockout is in — the first with a tie still open that somebody
 * is drawn into — when it is bigger than a card's bracket: the draw waits for
 * the last eight, and until then the card shows neither.
 */
function bigRoundOn(rounds: BracketRound[] | undefined): BracketRound | undefined {
  const round = (rounds ?? []).find((r) => r.matches.some((m) => !m.winnerTeamId && (m.homeTeamId || m.awayTeamId)));
  return round && round.matches.length > BRACKET_TIES ? round : undefined;
}

/**
 * An event's knockouts for its card: the last rounds, each tie with both
 * sides drawn. A double elimination's lower half is left to the event's own
 * page — a column a round has no room for two trees.
 */
function lolBracket(event: LolSplit, teams: Map<string, Team>): DashboardBracket | undefined {
  return teamBracket(`${event.name} bracket`, event.playoffs, teams);
}

/**
 * A two-legged tie nobody is drawn into yet reaches us as one tie per leg —
 * a feed cannot pair fixtures without clubs. Read as they come, a semi-final
 * showed four slots, or the one club already through twice.
 */
type BracketTie = DashboardBracket["rounds"][number]["ties"][number];

function withoutSpareLegs(ties: BracketTie[], feeding: number | undefined): BracketTie[] {
  const alone = new Set<string>();
  const once = ties.filter((t) => {
    if (t.home.tbd === t.away.tbd) return true;
    const known = t.home.tbd ? t.away : t.home;
    const key = known.code + known.name;
    if (alone.has(key)) return false;
    alone.add(key);
    return true;
  });
  const slots = feeding === undefined ? once.length : Math.ceil(feeding / 2);
  if (feeding === undefined || once.length <= slots || once.length > feeding) return once;
  let spare = once.length - slots;
  return once.filter((t) => !(t.home.tbd && t.away.tbd && spare-- > 0));
}

/** A knockout between teams, for a card: LoL's events, a league's postseason. */
function teamBracket(
  label: string,
  playoffs: BracketRound[] | undefined,
  teams: Map<string, Team>
): DashboardBracket | undefined {
  const nobody: DashboardBracketSide = { name: "To be decided", code: "TBD", score: null, winner: false, tbd: true };
  // A feed's own stand-in for a slot ("TBD Away", ESPN's for the winner of
  // MLS's wild card) is nobody yet either, not a club with a crest.
  const entrant = (id: string | null, score: number | null | undefined, winner: boolean): DashboardBracketSide => {
    const team = id ? teams.get(id) : undefined;
    if (!id || /^tbd\b/i.test(team?.shortName ?? team?.name ?? "")) return nobody;
    return side(team, id, score ?? null, winner);
  };
  const all = (playoffs ?? [])
    // The third-place game is no step towards the final, and would take a column from one.
    .filter((round) => round.id !== "third-place")
    .map((round) => ({
      label: round.label,
      ties: round.matches
        .filter((m) => m.side !== "lower")
        .map((m) => ({
          id: m.id,
          // A two-legged tie is read by its aggregate.
          home: entrant(m.homeTeamId, m.aggregateHome ?? m.homeScore, Boolean(m.homeTeamId) && m.winnerTeamId === m.homeTeamId),
          away: entrant(m.awayTeamId, m.aggregateAway ?? m.awayScore, Boolean(m.awayTeamId) && m.winnerTeamId === m.awayTeamId),
          decided: Boolean(m.winnerTeamId),
          playedAt: m.date,
        })),
    }))
    .filter((round) => round.ties.length > 0)
    .map((round, i, list) => ({ ...round, ties: withoutSpareLegs(round.ties, list[i - 1]?.ties.length) }))
    // A preliminary round — fewer ties than the round it feeds (MLS's wild
    // card) — is no column of the bracket: alone, it read as the whole of it.
    .filter((round, i, list) => i === list.length - 1 || round.ties.length >= list[i + 1].ties.length);
  // Only from the last eight: a round of sixteen has no room on a card, so
  // while one is being played there is no bracket. Then the last three
  // rounds, their sides "TBD" until known.
  const playing = all.findIndex((round) => round.ties.some((t) => !t.decided));
  if (playing !== -1 && all[playing].ties.length > BRACKET_TIES) return undefined;
  // The round being played leads, unless too few follow it to fill the card.
  const tail = Math.max(0, all.length - BRACKET_ROUNDS);
  let start = playing === -1 ? tail : Math.min(playing, tail);
  while (start < all.length && all[start].ties.length > BRACKET_TIES) start++;
  const rounds = all.slice(start, start + BRACKET_ROUNDS);
  const drawn = rounds.some((round) => round.ties.some((t) => !t.home.tbd || !t.away.tbd));
  return drawn ? { label, short: "Bracket", rounds } : undefined;
}

/**
 * A racquet event's draw for its card: the last rounds, each side by surname
 * (a pair's two) with the sets it won. A tie nobody is drawn into yet is left
 * out, so an event under way shows the rounds it has reached.
 */
function racquetBracket(
  name: string,
  rounds: BracketRound[] | undefined,
  players: Team[],
  pairs: boolean
): DashboardBracket | undefined {
  const byId = teamsById(players);
  const entrant = (id: string, sets: number | null, winner: boolean): DashboardBracket["rounds"][number]["ties"][number]["home"] => {
    const p = byId.get(id);
    const shortName = p?.shortName ?? id;
    return {
      name: shortName,
      // "Coello/Tapia"; a player goes by the surname ("T. Fritz" → "Fritz").
      code: pairs ? shortName.replace(" / ", "/") : (shortName.split(" ").at(-1) ?? shortName),
      score: sets,
      winner,
      photos: pairs ? (p?.photos ?? []) : [p?.logoUrl ?? null],
      seed: p && /^\d+$/.test(p.code.trim()) ? p.code.trim() : undefined,
    };
  };
  if (bigRoundOn(rounds)) return undefined;
  const drawn = (rounds ?? [])
    .map((round) => ({
      label: round.label,
      ties: round.matches.flatMap((m) => {
        if (!m.homeTeamId || !m.awayTeamId) return [];
        const played = (m.legs ?? []).filter((leg) => leg.homeScore !== null && leg.awayScore !== null);
        // A set is won at six with two clear, or at seven: the one in play is nobody's yet.
        const took = (a: number, b: number): boolean => a > b && a >= 6 && (a - b >= 2 || a === 7);
        const sets = (home: boolean): number | null =>
          played.length === 0
            ? null
            : played.filter((leg) =>
                home ? took(leg.homeScore!, leg.awayScore!) : took(leg.awayScore!, leg.homeScore!)
              ).length;
        return [
          {
            id: m.id,
            home: entrant(m.homeTeamId, sets(true), m.winnerTeamId === m.homeTeamId),
            away: entrant(m.awayTeamId, sets(false), m.winnerTeamId === m.awayTeamId),
            decided: Boolean(m.winnerTeamId),
            playedAt: m.date ?? played.at(-1)?.date,
          },
        ];
      }),
    }))
    .filter(fitsCard)
    .slice(-BRACKET_ROUNDS);
  return drawn.length > 0 ? { label: `${name} draw`, short: "Draw", rounds: drawn } : undefined;
}

/** Each league's next tournament and the day it starts, soonest first. */
function lolComingUp(data: LolData): DashboardTable | null {
  const next = (data.upcoming ?? []).slice(0, CARD_ROWS);
  if (next.length === 0) return null;
  return {
    id: "coming-up",
    label: "Coming up",
    unranked: true,
    rows: next.map((u, i) => ({ position: i + 1, name: u.name, flagEmoji: "🗓️", value: formatDay(u.startDate) })),
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

/**
 * The day before the reader's today, `YYYY-MM-DD`: an event whose last day is
 * this or later and has a winner still leads its card, so a Sunday final's
 * champion is there all Monday.
 */
function yesterdayOf(clock: CardClock): string {
  const today = calendarDayInTimeZone(new Date(clock.now), clock.timeZone).getTime();
  return new Date(today - 86_400_000).toISOString().slice(0, 10);
}

/**
 * The event a tour's card leads with: one won yesterday or today on the
 * reader's calendar, with its winner, then the one on, else the next to start.
 */
function leadEvent<E extends { status: "completed" | "live" | "upcoming"; startDate: string; endDate: string }>(
  events: readonly E[],
  wonBy: (e: E) => string | undefined,
  clock: CardClock
): E | undefined {
  const yesterday = yesterdayOf(clock);
  return (
    events.findLast((e) => e.status === "completed" && e.endDate >= yesterday && wonBy(e) !== undefined) ??
    events.find((e) => e.status === "live") ??
    events.filter((e) => e.status === "upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  );
}

/**
 * The draw of the event a tour's card leads with, when the feed did not ship
 * it (it ships only the featured and the current one's): the card's faces come
 * from it. A provider that fails costs the faces, not the card.
 */
async function leadDraw(
  data: RacquetData,
  clock: CardClock,
  load: (tournamentId: string) => Promise<RacquetDraw | null>
): Promise<RacquetDraw | null> {
  const event = leadEvent(data.tournaments, (t) => t.champion, clock);
  if (!event || event.status === "upcoming" || event.bracket?.length) return null;
  return load(event.id).catch(() => null);
}

/** The lead event's three best seeds and, once it is won, the winner: the faces on its card. */
function eventFaces(
  rounds: BracketRound[] | undefined,
  players: Team[],
  rankings: PlayerRanking[],
  pairs: boolean
): Pick<NonNullable<DashboardSportCard["event"]>, "seeds" | "winnerFace" | "profiles"> {
  if (!rounds?.length) return {};
  const seeds = topSeeds({ rounds, players });
  // Only a played final has a winner, so an event still on shows none.
  const winnerId = rounds.find((r) => r.id === "final")?.matches.at(-1)?.winnerTeamId;
  const winnerFace = winnerId ? players.find((p) => p.id === winnerId) : undefined;
  const shown = [...seeds, ...(winnerFace ? [winnerFace] : [])];
  const profiles = Object.fromEntries(
    shown.map((p) => [p.id, { ranking: rankingOf(p, rankings, pairs), result: resultIn(rounds, p.id) }])
  );
  return {
    ...(seeds.length > 0 && { seeds }),
    ...(winnerFace && { winnerFace }),
    ...(shown.length > 0 && { profiles }),
  };
}

/**
 * Where an entry stands on the tour. A player is matched on the name the draw
 * and the rankings both print; a padel pair, whose draw carries surnames only,
 * on each surname — and only when exactly one ranked player has it.
 */
function rankingOf(entry: Team, rankings: PlayerRanking[], pairs: boolean): string | undefined {
  if (!pairs) {
    const r = rankings.find((p) => p.shortName === entry.shortName);
    return r ? `#${r.position} · ${r.points.toLocaleString("en-US")} pts` : undefined;
  }
  const places = entry.shortName.split(" / ").map((surname) => {
    const named = rankings.filter((p) => p.shortName.split(" ").at(-1) === surname.trim().split(" ").at(-1));
    return named.length === 1 ? `#${named[0].position}` : null;
  });
  return places.every((p) => p !== null) ? places.join(" / ") : undefined;
}

/** How far an entry got: the last round it is drawn into, and whether it won there. */
function resultIn(rounds: BracketRound[], id: string): string | undefined {
  const reached = rounds.findLast((r) => r.matches.some((m) => m.homeTeamId === id || m.awayTeamId === id));
  const tie = reached?.matches.find((m) => m.homeTeamId === id || m.awayTeamId === id);
  if (!reached || !tie) return undefined;
  if (!tie.winnerTeamId) return `In the ${reached.label}`;
  if (tie.winnerTeamId !== id) return `Lost in the ${reached.label}`;
  return reached.id === "final" ? "Champion" : `Won the ${reached.label}`;
}

/** The men's tour only, so no championship to pick: the hub follows no women's tour. */
function racquetCard(
  base: CardBase & { sportId: RacquetSport },
  data: RacquetData,
  context: string,
  clock: CardClock = utcClock(),
  draw: RacquetDraw | null = null
): DashboardSportCard {
  const event = leadEvent(data.tournaments, (t) => t.champion, clock);
  const rounds = draw?.rounds ?? event?.bracket;
  const players = draw?.players ?? data.drawPlayers ?? [];
  const faces = event ? eventFaces(rounds, players, data.rankings, base.sportId === "padel") : {};
  // An event still to start has no draw worth a column: the rankings stand alone.
  const pairs = base.sportId === "padel";
  const bracket =
    event && event.status !== "upcoming" ? racquetBracket(event.name, rounds, players, pairs) : undefined;
  return {
    ...base,
    context,
    event: event
      ? {
          name: event.name,
          detail: [event.location, event.surface, formatDayRange(event.startDate, event.endDate)]
            .filter(Boolean)
            .join(" · "),
          status: event.status,
          href: tournamentPath(base.sportId, event.id),
          ...(event.status === "completed" && { winner: event.champion, runnerUp: event.runnerUp }),
          ...faces,
        }
      : undefined,
    matches: [],
    bracket,
    tables: [
      {
        id: data.tour,
        label: "Rankings",
        rows: data.rankings.slice(0, CARD_ROWS).map(
          (p): DashboardTableRow => ({
            position: p.position,
            name: p.shortName,
            image: p.photoUrl ? { url: p.photoUrl, kind: "photo" } : undefined,
            flagEmoji: p.flagEmoji,
            value: p.points.toLocaleString("en-US"),
          })
        ),
      },
    ].filter((t) => t.rows.length > 0),
  };
}

/** The stop just won, on now, else next, and the tour's rankings: the racquet card's shape. */
function surfCard(base: CardBase, data: SurfData, clock: CardClock = utcClock()): DashboardSportCard {
  const stop = leadEvent(data.events, (e) => e.winner, clock);
  // The feed carries one draw; it is the lead stop's only while that stop is the one on or last surfed.
  const draw = stop && stop.status !== "upcoming" && data.draw?.eventId === stop.id ? data.draw : undefined;
  const bracket = stop && draw ? surfBracket(stop.name, draw) : undefined;
  const champion = draw?.rounds.at(-1)?.heats.at(-1)?.surfers.find((s) => s.place === 1 && s.athleteId);
  return {
    ...base,
    context: "Championship Tour",
    event: stop
      ? {
          name: stop.name,
          detail: [stop.location, formatDayRange(stop.startDate, stop.endDate)].join(" · "),
          status: stop.status,
          ...(stop.status === "completed" && { winner: stop.winner, runnerUp: stop.runnerUp }),
          ...(stop.status === "completed" &&
            champion && {
              winnerFace: {
                id: champion.athleteId!,
                name: "",
                shortName: champion.name,
                code: "",
                logoUrl: champion.imageUrl,
              },
            }),
        }
      : undefined,
    matches: [],
    bracket,
    tables: [
      {
        id: "wsl",
        label: "Rankings",
        rows: data.rankings.slice(0, CARD_ROWS).map(
          (r): DashboardTableRow => ({
            position: r.position,
            name: r.name,
            image: r.imageUrl ? { url: r.imageUrl, kind: "photo" } : undefined,
            value: r.points.toLocaleString("en-US"),
          })
        ),
      },
    ].filter((t) => t.rows.length > 0),
  };
}

/**
 * A stop's closing rounds for its card: the last heats that are one surfer
 * against another, each by surname with the heat total (the two best waves).
 * Earlier rounds put three or four in the water, which a tie's two rows
 * cannot say, and a heat whose surfers are still seeds' places is left out.
 */
function surfBracket(name: string, draw: SurfDraw): DashboardBracket | undefined {
  // Until the heats are one against one and down to the last eight, the rankings stand alone.
  const on = draw.rounds.find((r) => r.heats.some((h) => h.status !== "completed"));
  if (on && (on.heats.length > BRACKET_TIES || on.heats.some((h) => h.surfers.length !== 2))) return undefined;
  const rounds = draw.rounds
    .map((round) => ({
      label: round.label,
      ties: round.heats.flatMap((heat) => {
        const [a, b] = heat.surfers;
        if (heat.surfers.length !== 2 || !a.athleteId || !b.athleteId) return [];
        const entrant = (s: typeof a): DashboardBracket["rounds"][number]["ties"][number]["home"] => ({
          name: s.name,
          code: s.name.split(" ").at(-1) ?? s.name,
          score: s.score,
          scoreLabel: s.score?.toFixed(2),
          winner: s.place === 1,
          photos: [s.imageUrl ?? null],
        });
        return [{ id: heat.id, home: entrant(a), away: entrant(b), decided: heat.status === "completed" }];
      }),
    }))
    .filter(fitsCard)
    .slice(-BRACKET_ROUNDS);
  return rounds.length > 0 ? { label: `${name} heats`, short: "Heats", rounds } : undefined;
}

/**
 * The race the card leads with. One just run stays on the day it was run and
 * the next, on the reader's calendar, with its winner — a Sunday race until
 * Tuesday — and then the next one takes over; one on track comes first.
 */
function f1Highlight(data: F1Data, now: number, timeZone = "UTC"): F1DashboardHighlight | null {
  const dayOf = (instant: number): number => calendarDayInTimeZone(new Date(instant), timeZone).getTime();
  const yesterday = dayOf(now) - 86_400_000;
  const justRun = data.races.findLast(
    (r) => r.status === "completed" && dayOf(Date.parse(r.startsAt ?? `${r.date}T12:00:00Z`)) >= yesterday
  );
  const race = data.races.find((r) => r.status === "live") ?? justRun ?? leadRace(data.races);
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
 * A football-style card's lead games, from its feed's matches. A postponed or
 * cancelled game has no score to show and is no one's next game: left out.
 */
function featuredAndFollowing(
  all: Match[],
  teams: Map<string, Team>,
  clock: CardClock
): Pick<DashboardSportCard, "featured" | "following" | "matches"> {
  const games = all.filter((m) => m.status !== "postponed" && m.status !== "cancelled").map((m) => cardMatch(m, teams));
  return { ...leadGames(games, clock), matches: [] };
}

/**
 * A league card's lead: its games, or with none in the feed (the season is
 * over) the champion its bracket's final names, as a racquet card leads with
 * the tournament just won.
 */
function leadOrChampion(
  games: Match[],
  playoffs: BracketRound[] | undefined,
  teams: Map<string, Team>,
  clock: CardClock
): Pick<DashboardSportCard, "featured" | "following" | "matches" | "event" | "bracket"> {
  // The bracket from the round it fits a card (the last eight) on, games or
  // no games: it is how the postseason is read while it is played, too.
  const bracket = teamBracket("Postseason bracket", playoffs, teams);
  const lead = { ...featuredAndFollowing(games, teams, clock), bracket };
  if (lead.featured) return lead;
  const round = playoffs?.find((r) => r.id === "final");
  const final = round?.matches.at(-1);
  if (!round || !final?.winnerTeamId) return lead;
  const beatenId = final.winnerTeamId === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
  const wins = [final.homeScore, final.awayScore].filter((n) => n != null).sort((x, y) => y - x);
  const recent = final.date !== undefined && clock.now - new Date(final.date).getTime() < JUST_FINISHED_MS;
  return {
    matches: [],
    bracket,
    event: {
      name: round.label,
      detail: [final.bestOf && `Best of ${final.bestOf}`, final.date && formatDay(final.date, clock.timeZone)]
        .filter(Boolean)
        .join(" · "),
      status: "completed",
      label: recent ? undefined : "Season champions",
      winner: teams.get(final.winnerTeamId)?.shortName ?? final.winnerTeamId,
      winnerFace: teams.get(final.winnerTeamId),
      runnerUp: beatenId ? (teams.get(beatenId)?.code ?? beatenId) : undefined,
      score: wins.length === 2 ? `${wins[0]}–${wins[1]}` : undefined,
    },
  };
}

/**
 * The games a card's lead box steps through, in the order they are played:
 * yesterday's and today's results on the reader's calendar (the latest
 * `CARD_RECENT`), whatever is live, then the next ones — `CARD_SLIDES` in all,
 * at least `CARD_UPCOMING` of them still to come when there are some. With
 * nothing played lately and nothing ahead, the latest results.
 */
function leadGames(games: DashboardMatch[], clock: CardClock): Pick<DashboardSportCard, "featured" | "following"> {
  const byStart = [...games].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const dayOf = (instant: string | number): string =>
    calendarDayInTimeZone(new Date(instant), clock.timeZone).toISOString().slice(0, 10);
  // UTC midnight of the reader's today, a day back: calendar arithmetic, no DST.
  const yesterday = new Date(calendarDayInTimeZone(new Date(clock.now), clock.timeZone).getTime() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const results = byStart.filter((g) => g.status === "result");
  const recent = results.filter((g) => dayOf(g.startsAt) >= yesterday);
  const live = byStart.filter((g) => g.status === "live");
  const ahead = byStart.filter((g) => g.status === "upcoming");

  let picked: DashboardMatch[];
  if (recent.length + live.length + ahead.length === 0) {
    picked = results.slice(-CARD_SLIDES);
  } else {
    const keptRecent = Math.min(recent.length, CARD_RECENT);
    const upcoming = ahead.slice(0, Math.max(CARD_UPCOMING, CARD_SLIDES - live.length - keptRecent));
    const room = Math.min(keptRecent, Math.max(0, CARD_SLIDES - live.length - upcoming.length));
    picked = [...recent.slice(recent.length - room), ...live, ...upcoming];
  }
  const [featured, ...following] = picked;
  return featured ? { featured, following } : { following: [] };
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

function matchTone(match: Match): DashboardMatch["status"] {
  if (match.status === "live") return "live";
  if (match.status === "scheduled") return "upcoming";
  return "result";
}

/** Pure helpers, exported for their tests. */
export const __testing = { footballCard, leadGames, leadOrChampion, lolCard, lolSwiss, racquetCard, surfCard, swissRecords, f1Highlight };
