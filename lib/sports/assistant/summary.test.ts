import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import { getFootballLeague } from "@/lib/data/sports/football";
import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import type { FootballLeagueData, Match } from "@/types/sports";

import { summarizeSport, type SummaryOptions } from "./summary";

const OPTIONS = { timeZone: "America/Costa_Rica", now: Date.parse("2026-03-18T12:00:00Z") };
const OPTIONS_LIST = [{ id: "uefa-champions-league" as const, name: "UEFA Champions League" }];

/** What the model reads every later turn: it has to stay small. */
const size = (value: unknown): number => JSON.stringify(value).length;

function football(league: FootballLeagueData, options: SummaryOptions = OPTIONS) {
  return summarizeSport({ sport: "football", league, options: OPTIONS_LIST, news: [] }, options);
}

describe("summarizeSport, a team sport", () => {
  it("lists yesterday's and today's results, the table and the knockout, on the reader's clock", () => {
    const summary = football(getFootballLeague("uefa-champions-league"));

    expect(summary).toMatchObject({
      sport: "football",
      competition: { id: "uefa-champions-league", name: "UEFA Champions League" },
      live: [],
      upcoming: expect.any(Array),
    });
    const results = summary.results as { match: string; status: string; when: string }[];
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual({
      match: expect.stringMatching(/^.+ \d+-\d+ .+$/),
      status: expect.stringMatching(/^final/),
      when: expect.stringMatching(/^2026-03-1[78] \d{2}:\d{2}$/),
      stage: expect.any(String),
    });
    expect((summary.table as string[])[0]).toMatch(/^1\. Arsenal 24 pts \(P8 8-0-0, GD \+19\)$/);
    expect(summary.knockout).toEqual(
      expect.arrayContaining([expect.objectContaining({ round: "Final", ties: [expect.any(String)] })])
    );
    expect(size(summary)).toBeLessThan(6000);
  });

  it("narrows to one team's last results and next games", () => {
    const summary = football(getFootballLeague("la-liga"), { ...OPTIONS, team: "real madrid" });
    const games = [...(summary.results as { match: string }[]), ...(summary.upcoming as { match: string }[])];
    expect(games.length).toBeGreaterThan(0);
    expect(games.every((g) => g.match.includes("Real Madrid"))).toBe(true);
  });

  it("says when no team has the name asked for", () => {
    const summary = summarizeSport(
      { sport: "football", league: getFootballLeague("la-liga"), options: OPTIONS_LIST },
      { ...OPTIONS, team: "Nowhere FC" }
    );
    expect(summary.note).toMatch(/No team called "Nowhere FC"/);
  });

  it("keeps a season of hundreds of games to a page of them", () => {
    const base = getFootballLeague("la-liga");
    const [home, away] = base.teams;
    const games: Match[] = Array.from({ length: 380 }, (_, i) => ({
      id: `m${i}`,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore: i < 190 ? 1 : null,
      awayScore: i < 190 ? 0 : null,
      kickoff: new Date(Date.parse("2026-01-01T18:00:00Z") + i * 6 * 3600_000).toISOString(),
      status: i < 190 ? "ft" : "scheduled",
    }));
    const summary = football({ ...base, matches: games });
    const count = ["results", "live", "upcoming"].reduce((n, k) => n + (summary[k] as unknown[]).length, 0);
    expect(count).toBeLessThanOrEqual(15);
    expect((summary.results as unknown[]).length).toBeLessThanOrEqual(8);
    expect(size(summary)).toBeLessThan(6000);
  });

  it("owns up to the sample", () => {
    const summary = summarizeSport(
      { sport: "football", league: getFootballLeague("la-liga"), options: OPTIONS_LIST, sample: true },
      OPTIONS
    );
    expect(summary.sampleData).toMatch(/sample/);
  });
});

describe("summarizeSport, F1", () => {
  it("gives the next race and its sessions, the last podium and both championships' top ten", () => {
    const summary = summarizeSport({ sport: "f1", data: F1_DATA, news: [] }, OPTIONS);

    expect(summary.nextRace).toMatchObject({
      round: 7,
      name: "Emilia Romagna GP",
      status: "upcoming",
      // 13:00 UTC is 07:00 in Costa Rica.
      start: "2026-05-24 07:00",
      sessions: expect.arrayContaining(["Qualifying 2026-05-23 08:00", "Race 2026-05-24 07:00"]),
    });
    expect(summary.lastRace).toMatchObject({
      round: 6,
      winner: "Max Verstappen (Red Bull)",
      podium: ["Max Verstappen (Red Bull)", "Andrea Kimi Antonelli (Mercedes)", "Lewis Hamilton (Ferrari)"],
    });
    expect(summary.drivers).toHaveLength(10);
    expect(summary.constructors).toHaveLength(10);
    expect(summary.calendar).toContain("R6 Miami GP, 2026-05-10, completed, won by VER");
    expect(size(summary)).toBeLessThan(6000);
  });
});

describe("summarizeSport, a racquet sport", () => {
  it("lists the tournaments just played, on and next with their ids, and the top ten", () => {
    const summary = summarizeSport({ sport: "tennis", data: TENNIS_DATA }, OPTIONS);
    const tournaments = summary.tournaments as { id: string; status: string }[];

    expect(tournaments).toContainEqual(
      expect.objectContaining({ id: "atp-rg", name: "Roland Garros", status: "live", tier: "Grand Slam" })
    );
    expect(tournaments.filter((t) => t.status === "completed").length).toBeLessThanOrEqual(3);
    expect(summary.rankings).toHaveLength(10);
    expect((summary.rankings as string[])[0]).toBe("1. Jannik Sinner (ITA) 11830 pts");
    expect(size(summary)).toBeLessThan(6000);
  });

  it("finds a tournament of the season by name", () => {
    const summary = summarizeSport({ sport: "tennis", data: TENNIS_DATA }, { ...OPTIONS, tournament: "australian" });
    expect(summary.tournaments).toEqual([
      expect.objectContaining({ id: "atp-ao", name: "Australian Open", champion: "J. Sinner" }),
    ]);
  });
});
