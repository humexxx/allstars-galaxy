import { afterEach, describe, expect, it, vi } from "vitest";

import { getFootballLeague } from "@/lib/data/sports/football";

import crcDays from "./__fixtures__/espn-crc-days-2026-10-26.json";
import crcPostseason from "./__fixtures__/espn-crc-postseason-2025.json";
import crcStandings from "./__fixtures__/espn-crc-standings-2026.json";
import mlsDays from "./__fixtures__/espn-mls-days-2026-10-26.json";
import mlsPostseason from "./__fixtures__/espn-mls-postseason-2025.json";
import mlsStandings from "./__fixtures__/espn-mls-standings-2026.json";
import { __testing, getEspnFootballLeague, type FootballEvent } from "./espn-football-service";

const { activeSpan, earlierSpans, gameFrom, knockoutFrom, knockoutGamesFrom, leagueDataFrom, liveClock, standingsFrom, LEAGUES } =
  __testing;
const MLS = LEAGUES.mls;
const CRC = LEAGUES["costa-rica"];

// The scores bar and the tables as ESPN sent them in October 2026, trimmed to
// the fields read: MLS's 2025 play-offs, Costa Rica's 2025 Apertura play-offs,
// a few days of each league around 26 October 2026 and both tables.
const MLS_DAYS: FootballEvent[] = mlsDays as FootballEvent[];
const MLS_POSTSEASON: FootballEvent[] = mlsPostseason as FootballEvent[];
const CRC_DAYS: FootballEvent[] = crcDays as FootballEvent[];
const CRC_POSTSEASON: FootballEvent[] = crcPostseason as FootballEvent[];

/** The 2025 regular season's final conference seeds, which ordered that year's Round One. */
const MLS_SEEDS_2025: Record<string, number> = {
  phi: 1, cin: 2, mia: 3, clt: 4, nyc: 5, nsh: 6, clb: 7, chi: 8, orl: 9,
  sd: 1, van: 2, lafc: 3, min: 4, sea: 5, atx: 6, dal: 7, por: 8, rsl: 9,
};

const eventById = (events: FootballEvent[], id: string): FootballEvent => {
  const found = events.find((e) => e.id === id);
  if (!found) throw new Error(`no event ${id}`);
  return found;
};

const tie = (m: { homeTeamId: string | null; awayTeamId: string | null }): string => `${m.homeTeamId}-${m.awayTeamId}`;

describe("gameFrom", () => {
  it("reads a game in play with its minute", () => {
    const game = gameFrom(eventById(MLS_DAYS, "761904"), MLS)!;
    expect(game.match).toMatchObject({ homeTeamId: "lafc", awayTeamId: "la", status: "live", minute: 33, homeScore: 0 });
    expect(game.match.statusText).toBeUndefined();
  });

  it("keeps a shoot-out beside the score it settled", () => {
    // Philadelphia 2–2 Chicago, 4–2 on penalties: ESPN's STATUS_FINAL_PEN.
    const game = gameFrom(eventById(MLS_POSTSEASON, "760067"), MLS)!;
    expect(game.match).toMatchObject({
      homeTeamId: "phi",
      awayTeamId: "chi",
      homeScore: 2,
      awayScore: 2,
      status: "pen",
      penalties: { home: 4, away: 2 },
      stageLabel: "East · Round One · Game 1",
    });
    expect(game.winnerTeamId).toBe("phi");
  });

  it("names a play-off game's stage, and leaves a league game's unsaid", () => {
    expect(gameFrom(eventById(MLS_POSTSEASON, "760058"), MLS)!.match.stageLabel).toBe("West · Wild card");
    expect(gameFrom(eventById(MLS_POSTSEASON, "762182"), MLS)!.match.stageLabel).toBe("MLS Cup");
    expect(gameFrom(eventById(MLS_DAYS, "761889"), MLS)!.match).toMatchObject({ status: "ft" });
    expect(gameFrom(eventById(MLS_DAYS, "761889"), MLS)!.match.stageLabel).toBeUndefined();
    expect(gameFrom(eventById(CRC_POSTSEASON, "762470"), CRC)!.match.stageLabel).toBe("Apertura semi-final · Leg 1");
    expect(gameFrom(eventById(CRC_POSTSEASON, "762651"), CRC)!.match.stageLabel).toBe("Apertura final");
    const league = gameFrom(eventById(CRC_DAYS, "401876833"), CRC)!.match;
    expect(league).toMatchObject({ status: "live", minute: 85 });
    expect(league.stageLabel).toBeUndefined();
  });

  it("calls a relegation play-off by its name", () => {
    const event = { ...eventById(CRC_DAYS, "401876890"), group: { name: "Clausura- Relegation Playoffs" } };
    expect(gameFrom(event, CRC)!.match.stageLabel).toBe("Relegation play-off");
  });
});

describe("liveClock", () => {
  const status = (name: string, shortDetail: string): FootballEvent["fullStatus"] => ({
    type: { name, state: "in", shortDetail },
  });

  it("reads the minute, and stoppage time in its own words", () => {
    expect(liveClock(status("STATUS_SECOND_HALF", "67'"))).toEqual({ minute: 67 });
    expect(liveClock(status("STATUS_SECOND_HALF", "90'+5'"))).toEqual({
      minute: 90,
      statusText: { short: "90+5'", spoken: "Live, minute 90 plus 5" },
    });
  });

  it("says half-time at the break", () => {
    expect(liveClock(status("STATUS_HALFTIME", "HT"))).toEqual({ statusText: { short: "HT", spoken: "Half-time" } });
  });
});

describe("standingsFrom", () => {
  it("keeps MLS's two conferences, each in ESPN's ranking with its zones from ESPN's notes", () => {
    const { groups } = standingsFrom(mlsStandings, MLS);
    expect(groups.map((g) => g.label)).toEqual(["East", "West"]);
    const east = groups[0].standings;
    expect(east).toHaveLength(15);
    expect(east.map((s) => s.position)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(east.slice(0, 3).map((s) => s.teamId)).toEqual(["nsh", "ne", "mia"]);
    expect(east.map((s) => s.band)).toEqual([
      ...Array(7).fill("champions"),
      "playoff",
      "playoff",
      ...Array(6).fill(null),
    ]);
    expect(east[0]).toMatchObject({ played: 31, won: 21, drawn: 7, lost: 3, goalsFor: 66, goalsAgainst: 23, points: 70 });
  });

  it("gives Costa Rica's one table its zones by rank, and the tournament with the season", () => {
    const { groups, season, teams } = standingsFrom(crcStandings, CRC);
    expect(groups).toHaveLength(1);
    expect(groups[0].standings.map((s) => s.teamId)).toEqual(["sap", "car", "ssj", "adsc", "ala", "pun", "isc", "her", "bel", "zel"]);
    expect(groups[0].standings.map((s) => s.band)).toEqual([...Array(4).fill("champions"), ...Array(6).fill(null)]);
    expect(season).toBe("2026–27 Apertura");
    expect(teams.find((t) => t.id === "sap")?.logoUrl).toContain("/i/teamlogos/soccer/500/858.png");
  });
});

describe("leagueDataFrom", () => {
  it("puts MLS's conferences in groups and the league-wide table in standings", () => {
    const data = leagueDataFrom(MLS, { days: MLS_DAYS, standings: mlsStandings, teams: null, earlier: [] }, "2026-10-26");
    expect(data.league).toMatchObject({ id: "mls", name: "Major League Soccer", season: "2026", hasKnockout: true });
    expect(data.groups?.map((g) => g.label)).toEqual(["East", "West"]);
    // The Supporters' Shield: points, then wins — Vancouver's 16 beat Miami's 15 on 55.
    expect(data.standings).toHaveLength(30);
    expect(data.standings.slice(0, 4).map((s) => `${s.position} ${s.teamId}`)).toEqual(["1 nsh", "2 ne", "3 van", "4 mia"]);
    expect(data.standings.every((s) => s.band === null)).toBe(true);
    expect(data.matches[0]).toMatchObject({ id: "761904", status: "live" });
    // Outside the play-offs, nothing to draw: the Knockout tab stays locked.
    expect(data.knockout).toBeUndefined();
  });

  it("tells Costa Rica's two San Carlos clubs apart, and keeps its one table as the standings", () => {
    const data = leagueDataFrom(CRC, { days: CRC_DAYS, standings: crcStandings, teams: null, earlier: [] }, "2026-10-26");
    expect(data.groups).toBeUndefined();
    expect(data.standings[0]).toMatchObject({ position: 1, teamId: "sap", band: "champions" });
    const names = data.teams.filter((t) => t.id === "adsc" || t.id === "isc").map((t) => t.shortName);
    expect(names.sort()).toEqual(["AD San Carlos", "Inter de San Carlos"]);
  });

  it("drops the Game 3s ESPN cancels once a series is won", () => {
    const data = leagueDataFrom(MLS, { days: MLS_POSTSEASON, standings: null, teams: null, earlier: [] }, "2025-12-10");
    expect(data.matches.some((m) => m.status === "cancelled")).toBe(false);
    expect(data.matches.filter((m) => m.stageLabel?.endsWith("Game 3"))).toHaveLength(5);
  });

  it("draws the bracket only from a whole play-off span", () => {
    const feeds = { days: MLS_POSTSEASON, standings: null, teams: null };
    expect(leagueDataFrom(MLS, { ...feeds, earlier: [] }, "2025-12-10").knockout).toHaveLength(5);
    expect(leagueDataFrom(MLS, { ...feeds, earlier: null }, "2025-12-10").knockout).toBeUndefined();
    expect(leagueDataFrom(MLS, { ...feeds, earlier: [] }, "2026-03-01").knockout).toBeUndefined();
  });

  it("throws with neither games nor a table, for the fixture to take over", () => {
    expect(() => leagueDataFrom(MLS, { days: [], standings: null, teams: null, earlier: [] }, "2026-10-26")).toThrow();
  });
});

describe("knockoutFrom", () => {
  const mlsBracket = (): ReturnType<typeof knockoutFrom> => {
    const { games } = knockoutGamesFrom(MLS_POSTSEASON, MLS, { from: "2025-10-15", to: "2025-12-20" });
    return knockoutFrom(games, MLS, (id) => MLS_SEEDS_2025[id]);
  };

  it("lays out MLS's play-offs, the East's half above the West's", () => {
    const rounds = mlsBracket();
    expect(rounds.map((r) => `${r.label} ${r.matches.length}`)).toEqual([
      "Wild card 2",
      "Round One 8",
      "Conference semi-finals 4",
      "Conference finals 2",
      "MLS Cup 1",
    ]);
    // 1 v 8 above 4 v 5, then 2 v 7 above 3 v 6, in each conference.
    expect(rounds[1].matches.map(tie)).toEqual([
      "phi-chi", "clt-nyc", "cin-clb", "mia-nsh",
      "sd-por", "min-sea", "van-dal", "lafc-atx",
    ]);
    expect(rounds[2].matches.map(tie)).toEqual(["phi-nyc", "cin-mia", "sd-min", "van-lafc"]);
    expect(rounds[3].matches.map(tie)).toEqual(["nyc-mia", "sd-van"]);
    expect(rounds[4].matches[0]).toMatchObject({ homeTeamId: "mia", awayTeamId: "van", homeScore: 3, awayScore: 1, winnerTeamId: "mia" });
  });

  it("scores Round One's best-of-three in wins, a shoot-out counting as one", () => {
    const [, roundOne] = mlsBracket();
    const minSea = roundOne.matches.find((m) => tie(m) === "min-sea")!;
    expect(minSea).toMatchObject({ homeScore: 2, awayScore: 1, winnerTeamId: "min", bestOf: 3 });
    // Philadelphia won in two; the Game 3 ESPN cancelled is not a game.
    expect(roundOne.matches[0]).toMatchObject({ homeScore: 2, awayScore: 0, winnerTeamId: "phi" });
  });

  it("keeps a one-game round's shoot-out from the tie's first side", () => {
    const [, , semis] = mlsBracket();
    expect(semis.matches[3]).toMatchObject({
      homeTeamId: "van",
      awayTeamId: "lafc",
      homeScore: 2,
      awayScore: 2,
      penalties: { home: 4, away: 3 },
      winnerTeamId: "van",
    });
  });

  it("shows every round from the first game on, a slot naming the winner it waits for", () => {
    const early = MLS_POSTSEASON.filter((e) => (e.date ?? "") < "2025-11-20");
    const { games } = knockoutGamesFrom(early, MLS, { from: "2025-10-15", to: "2025-12-20" });
    const rounds = knockoutFrom(games, MLS, (id) => MLS_SEEDS_2025[id]);
    expect(rounds.map((r) => r.matches.length)).toEqual([2, 8, 4, 2, 1]);
    expect(rounds[2].matches[0]).toMatchObject({ homeTeamId: "phi", awayTeamId: "nyc", winnerTeamId: null });
    expect(rounds[4].matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: null });
  });

  const crcBracket = (events: FootballEvent[] = CRC_POSTSEASON): ReturnType<typeof knockoutFrom> => {
    const { games } = knockoutGamesFrom(events, CRC, { from: "2025-11-15", to: "2025-12-31" });
    const seeds: Record<string, number> = { ala: 1, sap: 2, car: 3, lib: 4 };
    return knockoutFrom(games, CRC, (id) => seeds[id]);
  };

  it("pairs Costa Rica's legs into ties, on aggregate, 1 v 4 above 2 v 3", () => {
    const [semis, final] = crcBracket();
    expect(semis.matches[0]).toMatchObject({
      homeTeamId: "lib",
      awayTeamId: "ala",
      legs: [
        { homeScore: 1, awayScore: 1 },
        { homeScore: 0, awayScore: 3 },
      ],
      aggregateHome: 1,
      aggregateAway: 4,
      winnerTeamId: "ala",
    });
    expect(semis.matches[1]).toMatchObject({ homeTeamId: "car", awayTeamId: "sap", aggregateHome: 2, aggregateAway: 4, winnerTeamId: "sap" });
    // The final names nobody going through: the aggregate decides it, 5–3.
    expect(final.matches[0]).toMatchObject({
      homeTeamId: "ala",
      awayTeamId: "sap",
      legs: [
        { homeScore: 2, awayScore: 2 },
        { homeScore: 3, awayScore: 1 },
      ],
      aggregateHome: 5,
      aggregateAway: 3,
      winnerTeamId: "ala",
    });
  });

  it("takes ESPN's word on who goes through a tie level on aggregate", () => {
    // Saprissa through on the better regular-season place, not the score.
    const level = CRC_POSTSEASON.map((e) =>
      e.id === "762472"
        ? { ...e, competitors: e.competitors?.map((c) => ({ ...c, score: c.abbreviation === "SAP" ? "1" : "2" })) }
        : e
    );
    const [semis] = crcBracket(level);
    expect(semis.matches[1]).toMatchObject({ aggregateHome: 3, aggregateAway: 3, winnerTeamId: "sap" });
  });

  it("has no aggregate or winner until the second leg is over", () => {
    const [semis, final] = crcBracket(CRC_POSTSEASON.filter((e) => (e.date ?? "") < "2025-12-13"));
    expect(semis.matches[0]).toMatchObject({
      homeTeamId: "lib",
      awayTeamId: "ala",
      legs: [{ homeScore: 1, awayScore: 1 }],
      aggregateHome: null,
      winnerTeamId: null,
    });
    // Saprissa won the first leg at Cartaginés, and are not through for it.
    expect(semis.matches[1]).toMatchObject({ homeTeamId: "car", awayTeamId: "sap", winnerTeamId: null });
    expect(final.matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: null });
  });
});

describe("activeSpan", () => {
  it("keeps last season's bracket through the winter, and none in the spring", () => {
    expect(activeSpan(MLS, "2026-01-20")).toEqual({ from: "2025-10-15", to: "2025-12-20" });
    expect(activeSpan(MLS, "2026-11-01")).toEqual({ from: "2026-10-15", to: "2026-12-20" });
    expect(activeSpan(MLS, "2026-03-01")).toBeNull();
    expect(activeSpan(CRC, "2027-05-02")).toEqual({ from: "2027-04-15", to: "2027-06-15" });
  });

  it("reads the span's days before the ones listed, two months a request at most", () => {
    expect(earlierSpans({ from: "2025-10-15", to: "2025-12-20" }, "2025-12-09")).toEqual([
      { from: "2025-10-15", to: "2025-12-08" },
    ]);
    expect(earlierSpans({ from: "2026-10-15", to: "2026-12-20" }, "2026-09-14")).toEqual([]);
  });
});

describe("getEspnFootballLeague", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))));
  });

  it("falls back to the league's own fixture when ESPN does not answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getEspnFootballLeague("mls")).toBe(getFootballLeague("mls"));
    expect(await getEspnFootballLeague("costa-rica")).toBe(getFootballLeague("costa-rica"));
  });
});
