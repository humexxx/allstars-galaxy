import { afterEach, describe, expect, it, vi } from "vitest";

import { getFootballLeague } from "@/lib/data/sports/football";

import crcDays from "./__fixtures__/espn-crc-days-2026-10-26.json";
import crcPostseason from "./__fixtures__/espn-crc-postseason-2025.json";
import crcStandings from "./__fixtures__/espn-crc-standings-2026.json";
import mlsDays from "./__fixtures__/espn-mls-days-2026-10-26.json";
import mlsPostseason from "./__fixtures__/espn-mls-postseason-2025.json";
import mlsStandings from "./__fixtures__/espn-mls-standings-2026.json";
import { __testing, getEspnFootballLeague, teamIdsFor, type FootballEvent } from "./espn-football-service";

const {
  activeSpan,
  advancingFromNotes,
  earlierSpans,
  gameFrom,
  knockoutFrom,
  knockoutGamesFrom,
  leagueDataFrom,
  liveClock,
  standingsFrom,
  LEAGUES,
} = __testing;
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

  /** The scores bar answering with MLS's 2025 play-offs, and `earlier` for the span before the days listed. */
  const stubMls = (earlier: () => Response): void => {
    const board = (events: FootballEvent[]): Response =>
      new Response(JSON.stringify({ sports: [{ leagues: [{ events }] }] }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("dates=20251015-20251028")) return earlier();
        if (url.includes("/scoreboard/header")) return board(MLS_POSTSEASON);
        return new Response("{}", { status: 404 });
      })
    );
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws the bracket from the play-offs' earlier days", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-12-10T12:00:00Z"));
    stubMls(() => new Response(JSON.stringify({ sports: [{ leagues: [{ events: MLS_POSTSEASON }] }] })));
    const data = await getEspnFootballLeague("mls");
    expect(data.knockout).toHaveLength(5);
  });

  it("keeps the league live without a bracket when the play-offs' earlier days fail", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-12-10T12:00:00Z"));
    stubMls(() => new Response("{}", { status: 502 }));
    const data = await getEspnFootballLeague("mls");
    expect(data).not.toBe(getFootballLeague("mls"));
    expect(data.matches.length).toBeGreaterThan(0);
    expect(data.knockout ?? []).toHaveLength(0);
  });

  it("falls back to the league's own fixture when ESPN does not answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getEspnFootballLeague("mls")).toBe(getFootballLeague("mls"));
    expect(await getEspnFootballLeague("costa-rica")).toBe(getFootballLeague("costa-rica"));
  });
});

// ---------- Concacaf cups ----------

const CAC = LEAGUES["concacaf-central-american-cup"];
const CCC = LEAGUES["concacaf-champions-cup"];

type Side = [abbreviation: string, id: string, name: string, score?: number];

/** A Concacaf game as ESPN's scores bar sends it (November 2026), trimmed to the fields read. */
function cupEvent(
  id: string,
  date: string,
  group: string,
  [home, away]: [Side, Side],
  { leg, note }: { leg?: number; note?: string } = {}
): FootballEvent {
  const played = home[3] !== undefined;
  const side = ([abbreviation, teamId, name, score]: Side, homeAway: "home" | "away") => ({
    id: teamId,
    homeAway,
    abbreviation,
    displayName: name,
    name,
    score: score === undefined ? "" : String(score),
  });
  return {
    id,
    date,
    season: 2026,
    group: { name: group },
    ...(leg ? { leg: { value: leg } } : {}),
    ...(note ? { note } : {}),
    fullStatus: played
      ? { type: { name: "STATUS_FULL_TIME", state: "post", completed: true, shortDetail: "FT" } }
      : { type: { name: "STATUS_SCHEDULED", state: "pre", shortDetail: "Scheduled" } },
    competitors: [side(home, "home"), side(away, "away")],
  };
}

const ALA: Side = ["ALA", "2057", "Alajuelense"];
const CAR: Side = ["CAR", "7239", "Cartaginés"];
const SAP: Side = ["SAP", "858", "Saprissa"];
const OLI: Side = ["OLI", "884", "Club Deportivo Olimpia"];
const MOT: Side = ["MOT", "7242", "FC Motagua"];
const MAR: Side = ["MAR", "7249", "Club Deportivo Marathón"];
const LAF: Side = ["LAF", "7232", "Luis Ángel Firpo"];
const ALI_SV: Side = ["ALI", "7225", "Alianza FC"];
const ALI_PA: Side = ["ALI", "21520", "Alianza FC Panama"];
const with_ = (side: Side, score: number): Side => [side[0], side[1], side[2], score];

/** The 2026 Central American Cup from its quarter-finals: the final, Alajuelense v Cartaginés, still to play. */
const CAC_2026: FootballEvent[] = [
  cupEvent("q1", "2026-09-10T01:06:00Z", "Quarterfinals", [with_(CAR, 2), with_(SAP, 2)], { leg: 1 }),
  cupEvent("q2", "2026-09-10T03:06:00Z", "Quarterfinals", [with_(ALI_SV, 0), with_(MOT, 3)], { leg: 1 }),
  cupEvent("q3", "2026-09-11T01:06:00Z", "Quarterfinals", [with_(ALA, 2), with_(MAR, 2)], { leg: 1 }),
  cupEvent("q4", "2026-09-11T03:06:00Z", "Quarterfinals", [with_(OLI, 3), with_(LAF, 0)], { leg: 1 }),
  cupEvent("q5", "2026-09-17T00:30:00Z", "Quarterfinals", [with_(SAP, 2), with_(CAR, 3)], {
    leg: 2,
    note: "2nd Leg - Cartaginés win 5-4 on aggregate",
  }),
  cupEvent("q6", "2026-09-17T03:15:00Z", "Quarterfinals", [with_(MOT, 0), with_(ALI_SV, 0)], { leg: 2 }),
  cupEvent("q7", "2026-09-18T00:30:00Z", "Quarterfinals", [with_(MAR, 1), with_(ALA, 3)], { leg: 2 }),
  cupEvent("q8", "2026-09-18T03:15:00Z", "Quarterfinals", [with_(LAF, 0), with_(OLI, 3)], { leg: 2 }),
  cupEvent("p1", "2026-10-21T02:00:00Z", "Play-In", [with_(ALI_SV, 1), with_(MAR, 2)], { leg: 1 }),
  cupEvent("s1", "2026-10-22T02:30:00Z", "Semifinals", [with_(OLI, 0), with_(CAR, 1)], { leg: 1 }),
  cupEvent("s2", "2026-10-23T01:00:00Z", "Semifinals", [with_(ALA, 0), with_(MOT, 0)], { leg: 1 }),
  cupEvent("s3", "2026-10-29T03:00:00Z", "Semifinals", [with_(CAR, 2), with_(OLI, 2)], { leg: 2 }),
  cupEvent("s4", "2026-10-30T02:00:00Z", "Semifinals", [with_(MOT, 1), with_(ALA, 2)], { leg: 2 }),
  cupEvent("f1", "2026-12-03T01:00:00Z", "Finals", [ALA, CAR], { leg: 1 }),
  cupEvent("f2", "2026-12-07T00:00:00Z", "Finals", [CAR, ALA], { leg: 2, note: "2nd Leg - Tied on aggregate" }),
];

describe("Concacaf cups", () => {
  it("names each game's stage, a leg after it, and a group game by its group", () => {
    expect(gameFrom(CAC_2026[0], CAC)!.match.stageLabel).toBe("Quarter-final · Leg 1");
    expect(gameFrom(CAC_2026[14], CAC)!.match.stageLabel).toBe("Final · Leg 2");
    expect(gameFrom(CAC_2026[8], CAC)!.match.stageLabel).toBe("Play-in · Leg 1");
    const group = cupEvent("g1", "2026-07-30T02:00:00Z", "Group A", [with_(ALA, 1), with_(LAF, 0)]);
    expect(gameFrom(group, CAC)!.match.stageLabel).toBe("Group A");
    const final = cupEvent("c1", "2026-05-31T00:00:00Z", "Final", [with_(["UANL", "232", "Tigres UANL"], 1), with_(["TOL", "223", "Toluca"], 1)]);
    expect(gameFrom(final, CCC)!.phase).toMatchObject({ kind: "knockout", round: 3 });
    const roundOne = cupEvent("c2", "2026-02-04T00:00:00Z", "Round One", [with_(["UANL", "232", "Tigres UANL"], 0), with_(["FOR", "20026", "Forge"], 0)], { leg: 1 });
    expect(gameFrom(roundOne, CCC)!.match.stageLabel).toBe("Round One · Leg 1");
  });

  it("tells apart two clubs ESPN gives one abbreviation, and only those", () => {
    const idOf = teamIdsFor([ALI_SV, ALI_PA, ALA].map(([abbreviation, id]) => ({ abbreviation, id })));
    expect(idOf({ abbreviation: "ALI", id: "7225" })).toBe("ali-7225");
    expect(idOf({ abbreviation: "ALI", id: "21520" })).toBe("ali-21520");
    expect(idOf({ abbreviation: "ALA", id: "2057" })).toBe("ala");
  });

  it("reads who went through from Concacaf's notes", () => {
    const teams = [{ id: "car", name: "Cartaginés", shortName: "Cartaginés", code: "CAR" }, { id: "ala", name: "Alajuelense", shortName: "Alajuelense", code: "ALA" }];
    expect(advancingFromNotes({ note: "2nd Leg - Cartaginés win 5-4 on aggregate" }, teams)).toBe("car");
    expect(advancingFromNotes({ note: "2nd Leg - Tied on aggregate - ALA win 4-3 on penalties" }, teams)).toBe("ala");
    expect(advancingFromNotes({ note: "2nd Leg - Tied on aggregate" }, teams)).toBeNull();
  });

  it("draws the bracket by the ties each winner went on to, the final dated by its legs", () => {
    const today = "2026-11-22";
    const data = leagueDataFrom(
      CAC,
      { days: CAC_2026.filter((e) => e.date! >= "2026-10-11"), earlier: CAC_2026.filter((e) => e.date! < "2026-10-11"), standings: null, teams: null },
      today
    );
    const [qf, sf, final] = data.knockout!;
    // Each semi-final is fed by the two quarter-finals beside each other.
    expect(qf.matches.map(tie)).toEqual(["ala-mar", "ali-mot", "oli-laf", "car-sap"]);
    expect(sf.matches.map(tie)).toEqual(["ala-mot", "oli-car"]);
    expect(qf.matches[3].winnerTeamId).toBe("car");
    expect(final.matches[0]).toMatchObject({ homeTeamId: "ala", awayTeamId: "car", winnerTeamId: null });
    expect(final.matches[0].legs?.map((l) => l.date)).toEqual(["2026-12-03T01:00:00Z", "2026-12-07T00:00:00Z"]);
    // A cup lists its edition's earlier games too, and knows each club by ESPN's number.
    expect(data.matches.some((m) => m.id === "q1")).toBe(true);
    expect(data.providerTeamIds).toMatchObject({ ala: "2057", car: "7239" });
  });

  it("keeps the last Champions Cup up until the next opens, and the Central American Cup's until July", () => {
    expect(activeSpan(CCC, "2026-11-22")).toEqual({ from: "2026-02-01", to: "2026-06-15" });
    expect(activeSpan(CCC, "2027-01-10")).toEqual({ from: "2026-02-01", to: "2026-06-15" });
    expect(activeSpan(CAC, "2026-11-22")).toEqual({ from: "2026-07-20", to: "2026-12-20" });
    expect(activeSpan(CAC, "2027-03-01")).toEqual({ from: "2026-07-20", to: "2026-12-20" });
  });
});
