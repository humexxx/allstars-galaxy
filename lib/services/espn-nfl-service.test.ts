import { describe, expect, it } from "vitest";

import { __testing } from "./espn-nfl-service";

const { matchFrom, standingsFrom, roundFrom, statusFrom, teamFrom } = __testing;

const team = (abbreviation: string, shortDisplayName = abbreviation) => ({
  abbreviation,
  displayName: `${shortDisplayName} full`,
  shortDisplayName,
});

const status = (name: string, state: "pre" | "in" | "post") => ({
  type: { name, state, completed: state === "post" },
});

// Week 6 of 2026 as ESPN sent it, trimmed to what the mapper reads.
const event = (
  id: string,
  home: string,
  away: string,
  score: [string, string],
  state: "pre" | "in" | "post",
  extra: Record<string, unknown> = {}
) => ({
  id,
  date: "2026-10-18T20:25Z",
  season: { year: 2026, type: 2 },
  week: { number: 6 },
  competitions: [
    {
      date: "2026-10-18T20:25Z",
      status: status(state === "post" ? "STATUS_FINAL" : state === "in" ? "STATUS_IN_PROGRESS" : "STATUS_SCHEDULED", state),
      notes: [],
      competitors: [
        { homeAway: "home" as const, score: score[0], winner: state === "post" && Number(score[0]) > Number(score[1]), team: team(home) },
        { homeAway: "away" as const, score: score[1], winner: state === "post" && Number(score[1]) > Number(score[0]), team: team(away) },
      ],
    },
  ],
  ...extra,
});

describe("matchFrom", () => {
  it("maps a finished game with its week", () => {
    const { match, teams } = matchFrom(event("1", "KC", "LAC", ["22", "6"], "post"))!;
    expect(match).toMatchObject({
      homeTeamId: "kc",
      awayTeamId: "lac",
      homeScore: 22,
      awayScore: 6,
      status: "ft",
      stageLabel: "Week 6",
    });
    expect(teams.map((t) => t.primaryColor)).toEqual(["#E31837", "#0080C6"]);
  });

  it("leaves a game that has not kicked off without a score", () => {
    // ESPN sends "0" for both sides before kickoff; a 0–0 is not a result.
    const { match } = matchFrom(event("2", "GB", "DAL", ["0", "0"], "pre"))!;
    expect(match.homeScore).toBeNull();
    expect(match.status).toBe("scheduled");
  });

  it("keeps the score of a game in progress", () => {
    const { match } = matchFrom(event("3", "LAR", "ARI", ["9", "15"], "in"))!;
    expect(match).toMatchObject({ status: "live", homeScore: 9, awayScore: 15 });
  });

  it("labels a playoff game with ESPN's own note", () => {
    const playoff = event("4", "JAX", "BUF", ["24", "27"], "post", {
      season: { year: 2025, type: 3 },
      week: { number: 1 },
    });
    playoff.competitions[0].notes = [{ headline: "AFC Wild Card Playoffs" }] as never;
    expect(matchFrom(playoff)!.match.stageLabel).toBe("AFC Wild Card Playoffs");
  });
});

describe("statusFrom", () => {
  it("reads postponements and cancellations by name", () => {
    expect(statusFrom(status("STATUS_POSTPONED", "post"))).toBe("postponed");
    expect(statusFrom(status("STATUS_CANCELED", "post"))).toBe("cancelled");
    expect(statusFrom(status("STATUS_HALFTIME", "in"))).toBe("live");
  });
});

describe("teamFrom", () => {
  it("treats ESPN's TBD placeholder as nobody", () => {
    expect(teamFrom(team("TBD"))).toBeNull();
  });

  it("falls back to ESPN's colour for a team it does not know", () => {
    expect(teamFrom({ abbreviation: "XYZ", color: "123456" })!.primaryColor).toBe("#123456");
  });

  it("takes the scoreboard's logo, at the size it is drawn", () => {
    // The scoreboard sends a 4096px original — half a megabyte per badge.
    const packers = teamFrom({
      ...team("GB", "Packers"),
      logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/gb.png",
    });
    expect(packers!.logoUrl).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/scoreboard/gb.png&w=96&h=96&scale=crop"
    );
  });

  it("takes the standings' default logo, so a team on its bye has one too", () => {
    const bills = teamFrom({
      ...team("BUF", "Bills"),
      logos: [
        { href: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png" },
        { href: "https://a.espncdn.com/i/teamlogos/nfl/500-dark/scoreboard/buf.png" },
      ],
    });
    expect(bills!.logoUrl).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/buf.png&w=96&h=96&scale=crop"
    );
  });

  it("leaves the badge to the colour when ESPN sends no logo", () => {
    expect(teamFrom(team("KC"))!.logoUrl).toBeUndefined();
  });
});

describe("standingsFrom", () => {
  const entry = (abbreviation: string, stats: Record<string, number | string>) => ({
    team: team(abbreviation),
    stats: Object.entries(stats).map(([name, v]) => ({
      name,
      displayValue: String(v),
      value: typeof v === "number" ? v : null,
    })),
  });

  // `standings?level=3`: conference → division → entries.
  const table = {
    children: [
      {
        abbreviation: "AFC",
        children: [
          {
            abbreviation: "WEST",
            standings: {
              entries: [
                entry("KC", { playoffSeed: 1, wins: 5, losses: 0, ties: 0, winPercent: 1, pointsFor: 140, pointsAgainst: 83, streak: "W5" }),
                entry("LAC", { playoffSeed: 16, wins: 0, losses: 6, ties: 0, winPercent: 0, pointsFor: 70, pointsAgainst: 160, streak: "L6" }),
              ],
            },
          },
          {
            abbreviation: "EAST",
            standings: {
              entries: [
                entry("BUF", { playoffSeed: 2, wins: 5, losses: 1, ties: 0, winPercent: 0.833, pointsFor: 197, pointsAgainst: 171, streak: "W2" }),
              ],
            },
          },
        ],
      },
    ],
  };

  it("places each team at its conference seed, with its division", () => {
    const { standings, teams } = standingsFrom(table);
    expect(standings.map((s) => [s.position, s.teamId, s.division])).toEqual([
      [1, "kc", "afc-west"],
      [2, "buf", "afc-east"],
      [3, "lac", "afc-west"],
    ]);
    expect(standings[0]).toMatchObject({ wins: 5, losses: 0, pct: 1, pointsFor: 140, streak: "W5" });
    expect(teams).toHaveLength(3);
  });

  it("orders by win percentage before the seeds are out", () => {
    const unseeded = structuredClone(table);
    for (const division of unseeded.children[0].children) {
      for (const e of division.standings.entries) {
        e.stats = e.stats.filter((s) => s.name !== "playoffSeed");
      }
    }
    expect(standingsFrom(unseeded).standings.map((s) => s.teamId)).toEqual(["kc", "buf", "lac"]);
  });
});

describe("roundFrom", () => {
  const wildCard = (id: string, home: string, away: string, score: [string, string], conference: "AFC" | "NFC") => {
    const e = event(id, home, away, score, "post", { season: { year: 2025, type: 3 }, week: { number: 1 } });
    e.competitions[0].notes = [{ headline: `${conference} Wild Card Playoffs` }] as never;
    return e;
  };

  it("keeps each conference on its own side of the draw", () => {
    const round = roundFrom(
      {
        events: [
          wildCard("1", "CAR", "LAR", ["31", "34"], "NFC"),
          wildCard("2", "JAX", "BUF", ["24", "27"], "AFC"),
        ],
      },
      { week: 1, id: "round-of-16", label: "Wild Card" }
    )!;
    expect(round.label).toBe("Wild Card");
    expect(round.matches.map((m) => m.homeTeamId)).toEqual(["jax", "car"]);
    expect(round.matches[0]).toMatchObject({ homeScore: 24, awayScore: 27, winnerTeamId: "buf" });
  });

  it("names the Super Bowl by its own note and leaves an undecided side empty", () => {
    const final = event("9", "TBD", "SEA", ["0", "0"], "pre", { season: { year: 2025, type: 3 } });
    final.competitions[0].notes = [{ headline: "Super Bowl LX" }] as never;
    const round = roundFrom({ events: [final] }, { week: 5, id: "final", label: "Super Bowl" })!;
    expect(round.label).toBe("Super Bowl LX");
    expect(round.matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: "sea", homeScore: null });
  });

  it("returns nothing for a round with no games", () => {
    expect(roundFrom({ events: [] }, { week: 2, id: "quarter-final", label: "Divisional" })).toBeNull();
  });
});

describe("weeksAround", () => {
  const { weeksAround } = __testing;

  it("is four weeks back and three ahead of the current one", () => {
    expect(weeksAround(7, 2)).toEqual([3, 4, 5, 6, 8, 9, 10]);
  });

  it("stays inside the season: week 1 has nothing behind it, week 18 nothing ahead", () => {
    expect(weeksAround(1, 2)).toEqual([2, 3, 4]);
    expect(weeksAround(17, 2)).toEqual([13, 14, 15, 16, 18]);
    expect(weeksAround(3, 1)).toEqual([1, 2, 4]);
  });

  it("asks for nothing more in the postseason, the off-season or without a week", () => {
    expect(weeksAround(2, 3)).toEqual([]);
    expect(weeksAround(1, 4)).toEqual([]);
    expect(weeksAround(undefined, 2)).toEqual([]);
  });
});
