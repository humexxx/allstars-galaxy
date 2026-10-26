import { featuredEvent } from "@/lib/data/sports/surf";
import { isBracketDrawn, roundInPlay } from "@/lib/sports/bracket";
import { raceSessions, SESSION_LABEL } from "@/lib/sports/f1-weekend";
import { matchDay } from "@/lib/sports/match-days";
import { fromF1Wire } from "@/lib/sports/news";
import type { SportPayload } from "@/lib/sports/payload";
import { addDays, featuredTournament, justFinished, seasonOf } from "@/lib/sports/racquet";
import type {
  BracketMatch,
  BracketRound,
  F1Data,
  F1Race,
  F1WeekendResults,
  FootballLeagueData,
  LolData,
  LolMatch,
  Match,
  NewsStory,
  RacquetData,
  SurfData,
  SwissStage,
  Team,
} from "@/types/sports";

/**
 * One sport as the assistant reads it: the page's own feed, cut down to what
 * answers a question — the latest results, what is live and what is next,
 * the tables, a bracket being played, the headlines.
 *
 * Small on purpose (a few KB): the model reads every tool result again on
 * every later turn of the conversation. Times are on the reader's clock, as
 * "YYYY-MM-DD HH:mm".
 */
export type SportSummary = Record<string, unknown>;

export type SummaryOptions = {
  timeZone: string;
  now: number;
  /** A LoL league or event (football's league is already the payload's). */
  competition?: string;
  /** Only this team's matches. */
  team?: string;
  /** Padel or tennis: the season's tournaments whose name has this in it. */
  tournament?: string;
};

/** Matches listed at most, results, live and next together. */
const MATCHES = 15;
/** Of them, results from yesterday and today at most. */
const RESULTS = 8;
/** A team's own: its last results and its next games. */
const TEAM_GAMES = 3;
const TOP = 10;
const NEWS = 5;
/** A bracket with more ties is cut to the rounds still being played. */
const BRACKET_TIES = 31;

export function summarizeSport(payload: SportPayload, options: SummaryOptions): SportSummary {
  const base = {
    sport: payload.sport,
    ...(payload.sample ? { sampleData: "The live feed is down: this is the page's made-up sample, say so." } : {}),
  };
  switch (payload.sport) {
    case "football":
      return { ...base, ...footballSummary(payload.league, options), news: headlines(payload.news, options) };
    case "f1":
      return {
        ...base,
        ...f1Summary(payload.data, payload.weekend, options),
        news: headlines(fromF1Wire(payload.news), options),
      };
    case "nba": {
      const { data } = payload;
      return {
        ...base,
        season: data.season,
        ...teamGames(data.games, data.teams, options),
        standings: grouped(
          data.standings,
          (s) => (s.conference === "east" ? "East" : "West"),
          (s, name) => `${s.position}. ${name} ${s.won}-${s.lost} (GB ${s.gamesBehind}, ${s.streak})`,
          data.teams
        ),
        ...bracket("playoffs", data.playoffs, data.teams),
        ...(data.champion ? { lastChampion: data.champion.summary } : {}),
        ...(data.tipOff ? { seasonStarts: when(data.tipOff, options.timeZone) } : {}),
        news: headlines(payload.news, options),
      };
    }
    case "nfl": {
      const { data } = payload;
      return {
        ...base,
        season: data.season,
        ...teamGames(data.games, data.teams, options),
        standings: grouped(
          data.standings,
          (s) => s.conference.toUpperCase(),
          (s, name) =>
            `${s.position}. ${name} ${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""} (${s.division.toUpperCase()})`,
          data.teams
        ),
        ...bracket("playoffs", data.playoffs, data.teams),
        news: headlines(payload.news, options),
      };
    }
    case "mlb": {
      const { data } = payload;
      return {
        ...base,
        season: data.season,
        ...teamGames(data.games, data.teams, options),
        standings: grouped(
          data.standings,
          (s) => (s.league === "al" ? "American League" : "National League"),
          (s, name) => `${s.position}. ${name} ${s.wins}-${s.losses} (${s.division.toUpperCase()}, GB ${s.gamesBehind})`,
          data.teams
        ),
        ...bracket("postseason", data.playoffs, data.teams),
        news: headlines(payload.news, options),
      };
    }
    case "nhl": {
      const { data } = payload;
      return {
        ...base,
        season: data.season,
        ...teamGames(data.games, data.teams, options),
        standings: grouped(
          data.standings,
          (s) => (s.conference === "east" ? "East" : "West"),
          (s, name) => `${s.position}. ${name} ${s.points} pts (${s.wins}-${s.losses}-${s.otLosses})`,
          data.teams
        ),
        ...bracket("playoffs", data.playoffs, data.teams),
        news: headlines(payload.news, options),
      };
    }
    case "tennis":
      return { ...base, ...racquetSummary(payload.data.atp, options), news: headlines(payload.news, options) };
    case "padel":
      return { ...base, ...racquetSummary(payload.data.men, options), news: headlines(payload.news, options) };
    case "surf":
      return { ...base, ...surfSummary(payload.data), news: headlines(payload.news, options) };
    case "lol":
      return { ...base, ...lolSummary(payload.data, options), news: headlines(payload.news, options) };
  }
}

// ---------- Team sports ----------

function footballSummary(data: FootballLeagueData, options: SummaryOptions): SportSummary {
  const { league } = data;
  const teams = byId(data.teams);
  const row = (s: FootballLeagueData["standings"][number]): string =>
    `${s.position}. ${nameOf(teams, s.teamId)} ${s.points} pts (P${s.played} ${s.won}-${s.drawn}-${s.lost}, GD ${signed(s.goalsFor - s.goalsAgainst)})`;
  const groups = data.groups && data.groups.length > 1 ? data.groups : null;
  return {
    competition: { id: league.id, name: league.name, season: league.season },
    ...teamGames(data.matches, data.teams, options),
    ...(groups
      ? { tables: groups.map((g) => ({ group: g.label, rows: g.standings.map(row) })) }
      : data.standings.length > 0
        ? { table: data.standings.map(row) }
        : {}),
    ...(data.knockout ? bracket("knockout", data.knockout, data.teams) : {}),
  };
}

type MatchLine = { match: string; status: string; when: string; stage?: string; tv?: string };

/**
 * The games to read off a match list: yesterday's and today's results (the
 * last few when there were none), every live one, then the next ones — or,
 * for one team, its last results and next games.
 */
function teamGames(matches: Match[], teamList: Team[], options: SummaryOptions): SportSummary {
  const teams = byId(teamList);
  let shown = matches;
  let note: string | undefined;
  if (options.team) {
    const ids = teamsMatching(teamList, options.team);
    if (ids.size > 0) shown = matches.filter((m) => ids.has(m.homeTeamId) || ids.has(m.awayTeamId));
    else note = `No team called "${options.team}" plays here; these are everybody's games.`;
  }
  const narrowed = Boolean(options.team) && !note;
  const line = (m: Match): MatchLine => matchLine(m, teams, options.timeZone);
  const { results, live, upcoming } = splitMatches(
    shown.map((m) => ({ at: m.kickoff, status: m.status, item: m })),
    options,
    narrowed
  );
  return {
    ...(note ? { note } : {}),
    results: results.map(line),
    live: live.map(line),
    upcoming: upcoming.map(line),
  };
}

type Dated<T> = { at: string; status: Match["status"]; item: T };

function splitMatches<T>(
  list: Dated<T>[],
  { timeZone, now }: SummaryOptions,
  narrowed: boolean
): { results: T[]; live: T[]; upcoming: T[] } {
  const today = matchDay(new Date(now).toISOString(), timeZone);
  const yesterday = addDays(today, -1);
  const byTime = [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const finished = byTime.filter((m) => m.status === "ft" || m.status === "aet" || m.status === "pen").reverse();
  const recent = finished.filter((m) => {
    const day = matchDay(m.at, timeZone);
    return day === today || day === yesterday;
  });
  const results = narrowed
    ? finished.slice(0, TEAM_GAMES)
    : (recent.length > 0 ? recent : finished).slice(0, recent.length > 0 ? RESULTS : TEAM_GAMES);
  const live = byTime.filter((m) => m.status === "live");
  const scheduled = byTime.filter((m) => m.status === "scheduled" || m.status === "postponed");
  const upcoming = scheduled.slice(0, narrowed ? TEAM_GAMES : Math.max(5, MATCHES - results.length - live.length));
  return { results: results.map((m) => m.item), live: live.map((m) => m.item), upcoming: upcoming.map((m) => m.item) };
}

function matchLine(m: Match, teams: Map<string, Team>, timeZone: string): MatchLine {
  const home = nameOf(teams, m.homeTeamId);
  const away = nameOf(teams, m.awayTeamId);
  const scored = m.homeScore !== null && m.awayScore !== null && m.status !== "scheduled";
  const pens = m.penalties ? ` (${m.penalties.home}-${m.penalties.away} on penalties)` : "";
  return {
    match: scored ? `${home} ${m.homeScore}-${m.awayScore} ${away}${pens}` : `${home} vs ${away}`,
    status: matchStatus(m),
    when: when(m.kickoff, timeZone),
    ...(m.stageLabel ? { stage: m.stageLabel } : {}),
    ...(m.broadcasts?.length ? { tv: m.broadcasts.slice(0, 2).join(", ") } : {}),
  };
}

function matchStatus(m: Match): string {
  switch (m.status) {
    case "live":
      return `live ${m.statusText?.short ?? (m.minute ? `${m.minute}'` : "")}`.trim();
    case "ft":
      return m.statusText?.short && m.statusText.short !== "FT" ? `final (${m.statusText.short})` : "final";
    case "aet":
      return "final after extra time";
    case "pen":
      return "final on penalties";
    default:
      return m.status;
  }
}

/** Tables split the way the sport splits them (conferences, leagues), each in order. */
function grouped<S extends { position: number; teamId: string }>(
  standings: S[],
  groupOf: (s: S) => string,
  row: (s: S, name: string) => string,
  teamList: Team[]
): Record<string, string[]> {
  const teams = byId(teamList);
  const out: Record<string, string[]> = {};
  for (const s of [...standings].sort((a, b) => a.position - b.position)) {
    (out[groupOf(s)] ??= []).push(row(s, nameOf(teams, s.teamId)));
  }
  return out;
}

/** A bracket under `key`, when anybody has been drawn into it. */
function bracket(key: string, rounds: BracketRound[] | undefined, teamList: Team[]): SportSummary {
  if (!rounds || !isBracketDrawn(rounds)) return {};
  return { [key]: bracketRounds(rounds, byId(teamList)) };
}

function bracketRounds(rounds: BracketRound[], teams: Map<string, Team>): { round: string; ties: string[] }[] {
  const total = rounds.reduce((n, r) => n + r.matches.length, 0);
  let shown = rounds;
  if (total > BRACKET_TIES) {
    // A Grand Slam's 127 ties: the round on now and what follows it.
    const from = rounds.indexOf(roundInPlay(rounds) ?? rounds[Math.max(0, rounds.length - 3)]);
    shown = rounds.slice(Math.max(0, from));
  }
  return shown.map((r) => ({ round: r.label, ties: r.matches.map((m) => tieLine(m, teams)) }));
}

function tieLine(m: BracketMatch, teams: Map<string, Team>): string {
  const home = m.homeTeamId ? nameOf(teams, m.homeTeamId) : "TBD";
  const away = m.awayTeamId ? nameOf(teams, m.awayTeamId) : "TBD";
  let score = "";
  if (m.outcome === "bye") score = " (bye)";
  else if (m.aggregateHome != null && m.aggregateAway != null) score = ` ${m.aggregateHome}-${m.aggregateAway} on aggregate`;
  else if (m.legs && m.legs.length > 1 && m.legs.every((l) => l.homeScore !== null && l.awayScore !== null)) {
    score = ` ${m.legs.map((l) => `${l.homeScore}-${l.awayScore}`).join(" ")}`;
  } else if (m.homeScore != null && m.awayScore != null) score = ` ${m.homeScore}-${m.awayScore}`;
  const pens = m.penalties ? ` (${m.penalties.home}-${m.penalties.away} pens)` : "";
  const best = m.bestOf && m.bestOf > 1 ? ` (best of ${m.bestOf})` : "";
  const outcome = m.outcome === "walkover" ? " (walkover)" : m.outcome === "retired" ? " (retired)" : "";
  const winner = m.winnerTeamId ? `, won by ${nameOf(teams, m.winnerTeamId)}` : "";
  return `${home} v ${away}${score}${pens}${best}${outcome}${winner}`;
}

// ---------- F1 ----------

function f1Summary(data: F1Data, weekend: F1WeekendResults | undefined, { timeZone }: SummaryOptions): SportSummary {
  const driver = (code: string): string => {
    const d = data.drivers.find((x) => x.code === code);
    return d ? `${d.name} (${d.team})` : code;
  };
  const next = data.races.find((r) => r.status === "live") ?? data.races.find((r) => r.status === "upcoming");
  const last = data.races.findLast((r) => r.status === "completed");
  return {
    season: data.season,
    ...(next
      ? {
          nextRace: {
            ...raceHead(next, timeZone),
            sessions: raceSessions(next).map((s) => `${SESSION_LABEL[s.kind]} ${when(s.startsAt, timeZone)}`),
          },
        }
      : {}),
    ...(weekend && weekend.sessions.length > 0
      ? {
          thisWeekend: weekend.sessions.map((s) => ({
            session: SESSION_LABEL[s.kind],
            top3: s.rows.slice(0, 3).map((r) => `${r.position}. ${r.name} (${r.team})${r.time ? ` ${r.time}` : ""}`),
          })),
        }
      : {}),
    ...(last
      ? {
          lastRace: {
            ...raceHead(last, timeZone),
            ...(last.winner ? { winner: driver(last.winner.code) } : {}),
            ...(last.podium ? { podium: last.podium.map(driver) } : {}),
            ...(last.pole ? { pole: driver(last.pole.code) } : {}),
            ...(last.fastestLap ? { fastestLap: driver(last.fastestLap.code) } : {}),
            ...(last.sprintWinner ? { sprintWinner: driver(last.sprintWinner.code) } : {}),
          },
        }
      : {}),
    drivers: data.drivers
      .slice(0, TOP)
      .map((d) => `${d.position}. ${d.name} (${d.team}) ${d.points} pts, ${d.wins} wins`),
    constructors: data.constructors.slice(0, TOP).map((c) => `${c.position}. ${c.name} ${c.points} pts`),
    calendar: data.races.map(
      (r) => `R${r.round} ${r.name}, ${r.date}, ${r.status}${r.winner ? `, won by ${r.winner.code}` : ""}`
    ),
  };
}

function raceHead(race: F1Race, timeZone: string): SportSummary {
  return {
    round: race.round,
    name: race.name,
    circuit: `${race.circuit}, ${race.location}${race.country ? `, ${race.country}` : ""}`,
    status: race.status,
    start: race.startsAt ? when(race.startsAt, timeZone) : race.date,
    ...(race.sprint ? { sprint: true } : {}),
  };
}

// ---------- Padel, tennis ----------

function racquetSummary(data: RacquetData, options: SummaryOptions): SportSummary {
  const season = seasonOf(data);
  const players = byId(data.drawPlayers ?? []);
  const tournament = (t: RacquetData["tournaments"][number]): SportSummary => ({
    id: t.id,
    name: t.name,
    ...(t.tier ? { tier: t.tier } : {}),
    where: t.location,
    dates: t.startDate === t.endDate ? t.startDate : `${t.startDate} to ${t.endDate}`,
    status: t.status,
    ...(t.champion ? { champion: t.champion } : {}),
    ...(t.runnerUp ? { runnerUp: t.runnerUp } : {}),
    ...(t.defendingChampion && !t.champion ? { defendingChampion: t.defendingChampion } : {}),
  });

  if (options.tournament) {
    const words = options.tournament.toLowerCase();
    const found = season.filter((t) => t.name.toLowerCase().includes(words)).slice(0, 8);
    return {
      season: data.season,
      tournaments: found.map(tournament),
      ...(found.length === 0 ? { note: `No tournament of the season is called "${options.tournament}".` } : {}),
    };
  }

  const featured = featuredTournament(season);
  const live = season.filter((t) => t.status === "live");
  const next = season.filter((t) => t.status === "upcoming").slice(0, 4);
  const listed = [...justFinished(season, 3).reverse(), ...live, ...next.filter((t) => !live.includes(t))];
  const drawn = featured?.bracket && isBracketDrawn(featured.bracket) ? featured : undefined;
  return {
    season: data.season,
    tournaments: listed.map(tournament),
    ...(drawn?.bracket ? { draw: { tournament: drawn.name, rounds: bracketRounds(drawn.bracket, players) } } : {}),
    rankings: data.rankings
      .slice(0, TOP)
      .map((p) => `${p.position}. ${p.name}${p.countryCode ? ` (${p.countryCode})` : ""} ${p.points} pts`),
  };
}

// ---------- Surf ----------

function surfSummary(data: SurfData): SportSummary {
  const featured = featuredEvent(data.events);
  const at = featured ? data.events.indexOf(featured) : data.events.length;
  const events = data.events.slice(Math.max(0, at - 2), at + 3).map((e) => ({
    id: e.id,
    stop: e.stop,
    name: e.name,
    where: e.location,
    dates: `${e.startDate} to ${e.endDate}`,
    status: e.status,
    ...(e.winner ? { winner: e.winner } : {}),
    ...(e.runnerUp ? { runnerUp: e.runnerUp } : {}),
  }));
  const started = data.draw?.rounds.filter((r) => r.heats.some((h) => h.status !== "upcoming")) ?? [];
  return {
    season: data.season,
    events,
    ...(data.draw && started.length > 0
      ? {
          draw: {
            event: data.events.find((e) => e.id === data.draw?.eventId)?.name,
            rounds: started.slice(-2).map((r) => ({
              round: r.label,
              heats: r.heats.map(
                (h) =>
                  `Heat ${h.number} (${h.status}): ${h.surfers
                    .map((s) => `${s.name}${s.score !== null ? ` ${s.score}` : ""}`)
                    .join(", ")}`
              ),
            })),
          },
        }
      : {}),
    rankings: data.rankings.slice(0, TOP).map((r) => `${r.position}. ${r.name} (${r.country}) ${r.points} pts`),
  };
}

// ---------- LoL ----------

function lolSummary(data: LolData, options: SummaryOptions): SportSummary {
  const split = data.splits.find((s) => s.region === options.competition) ?? data.splits[0];
  const competitions = data.splits.map((s) => ({ id: s.region, name: s.name }));
  if (!split) return { competitions, note: "Nothing is being played right now." };
  const teams = byId(split.teams);
  const narrowedTo = options.team ? teamsMatching(split.teams, options.team) : null;
  const matches =
    narrowedTo && narrowedTo.size > 0
      ? split.matches.filter((m) => narrowedTo.has(m.homeTeamId) || narrowedTo.has(m.awayTeamId))
      : split.matches;
  const { results, live, upcoming } = splitMatches(
    matches.map((m) => ({ at: m.date, status: m.status, item: m })),
    options,
    Boolean(narrowedTo && narrowedTo.size > 0)
  );
  const line = (m: LolMatch): MatchLine => {
    const home = nameOf(teams, m.homeTeamId);
    const away = nameOf(teams, m.awayTeamId);
    const scored = m.homeScore !== null && m.awayScore !== null && m.status !== "scheduled";
    return {
      match: scored ? `${home} ${m.homeScore}-${m.awayScore} ${away}` : `${home} vs ${away}`,
      status: m.status === "live" ? "live" : m.status === "scheduled" ? "scheduled" : m.status === "ft" ? "final" : m.status,
      when: `${when(m.date, options.timeZone)}, best of ${m.bestOf}`,
      ...(m.stageLabel ? { stage: m.stageLabel } : {}),
    };
  };
  return {
    competitions,
    competition: { id: split.region, name: split.name, season: split.season },
    ...(narrowedTo && narrowedTo.size === 0 ? { note: `No team called "${options.team}" plays here.` } : {}),
    results: results.map(line),
    live: live.map(line),
    upcoming: upcoming.map(line),
    ...(split.standings.length > 0
      ? {
          standings: split.standings.map((s) => `${s.position}. ${nameOf(teams, s.teamId)} ${s.wins}-${s.losses}`),
        }
      : {}),
    ...(split.swiss ? { swiss: swissSummary(split.swiss, teams) } : {}),
    ...(split.playIns && isBracketDrawn(split.playIns) ? { playIns: bracketRounds(split.playIns, teams) } : {}),
    ...(split.playoffs && isBracketDrawn(split.playoffs) ? { playoffs: bracketRounds(split.playoffs, teams) } : {}),
    ...(split.champion ? { champion: nameOf(teams, split.champion.teamId) } : {}),
    ...(data.upcoming?.length
      ? { nextTournaments: data.upcoming.slice(0, 4).map((u) => `${u.name} from ${u.startDate}`) }
      : {}),
  };
}

function swissSummary(stage: SwissStage, teams: Map<string, Team>): SportSummary {
  const current = stage.rounds.findLast((pools) => pools.some((p) => p.matches.some((m) => m.homeTeamId))) ?? [];
  return {
    rule: `${stage.winsToAdvance} wins go through, ${stage.lossesToExit} losses go out`,
    decided: stage.exits
      .filter((e) => e.teamIds.length > 0)
      .map((e) => `${e.wins}-${e.losses} ${e.advanced ? "through" : "out"}: ${e.teamIds.map((id) => nameOf(teams, id)).join(", ")}`),
    currentRound: current.map((pool) => ({
      record: `${pool.wins}-${pool.losses}`,
      matches: pool.matches.map((m) => tieLine(m, teams)),
    })),
  };
}

// ---------- Shared ----------

function headlines(news: NewsStory[] | undefined, { timeZone }: SummaryOptions): SportSummary[] {
  return (news ?? [])
    .filter((s) => s.kind !== "video")
    .slice(0, NEWS)
    .map((s) => ({ headline: s.headline, link: s.href, published: matchDay(s.at, timeZone) }));
}

function byId(teams: Team[]): Map<string, Team> {
  return new Map(teams.map((t) => [t.id, t]));
}

function nameOf(teams: Map<string, Team>, id: string): string {
  return teams.get(id)?.name ?? id;
}

/** The teams a name, short name or code points at: "Madrid" finds both Madrid clubs. */
function teamsMatching(teams: Team[], query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const exact = teams.filter(
    (t) => t.name.toLowerCase() === q || t.shortName.toLowerCase() === q || t.code.toLowerCase() === q
  );
  const found = exact.length > 0 ? exact : teams.filter((t) => `${t.name} ${t.shortName}`.toLowerCase().includes(q));
  return new Set(found.map((t) => t.id));
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

const WHEN_PARTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

/** An instant on the reader's clock, "2026-10-25 20:00"; a calendar day stays as it is. */
function when(value: string, timeZone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { ...WHEN_PARTS, timeZone }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
