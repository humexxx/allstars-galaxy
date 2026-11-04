import { afterEach, describe, expect, it, vi } from "vitest";

import type { Match, Team } from "@/types/sports";

import { withLateScores } from "./football-late-scores";

const NOW = Date.parse("2026-10-26T03:30:00Z");

const team = (id: string, name: string, shortName: string, code: string): Team => ({ id, name, shortName, code });
const TEAMS = new Map(
  [
    team("ath", "Athletic Club", "Athletic", "ATH"),
    team("get", "Getafe CF", "Getafe", "GET"),
    team("fcb", "FC Barcelona", "Barça", "FCB"),
    team("rma", "Real Madrid CF", "Real Madrid", "RMA"),
    team("sev", "Sevilla FC", "Sevilla", "SEV"),
    team("osa", "CA Osasuna", "Osasuna", "OSA"),
  ].map((t) => [t.id, t])
);

function fixture(id: string, home: string, away: string, kickoff: string, status: Match["status"] = "scheduled"): Match {
  const played = status !== "scheduled";
  return { id, homeTeamId: home, awayTeamId: away, homeScore: played ? 1 : null, awayScore: played ? 0 : null, kickoff, status };
}

type Side = { name: string; abbreviation: string; score: string; shootoutScore?: number };
function event(
  id: string,
  date: string,
  home: Side,
  away: Side,
  status: { name: string; state: "pre" | "in" | "post"; shortDetail?: string }
): unknown {
  return {
    id,
    date,
    fullStatus: { type: { ...status, completed: status.state === "post" } },
    competitors: [
      { ...home, displayName: home.name, homeAway: "home" },
      { ...away, displayName: away.name, homeAway: "away" },
    ],
  };
}

const FINAL = { name: "STATUS_FULL_TIME", state: "post" as const, shortDetail: "FT" };

function espnAnswers(events: unknown[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => Response.json({ sports: [{ leagues: [{ events }] }] }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withLateScores", () => {
  it("asks ESPN nothing when football-data is not behind on any game", async () => {
    const fetchMock = espnAnswers([]);
    const matches = [
      fixture("1", "ath", "get", "2026-10-25T13:00:00Z", "ft"),
      fixture("2", "sev", "osa", "2026-10-26T20:00:00Z"),
    ];
    expect(await withLateScores("la-liga", matches, TEAMS, NOW)).toBe(matches);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes the score and status of a game already played from ESPN, leaving the rest as they are", async () => {
    const fetchMock = espnAnswers([
      event(
        "e1",
        "2026-10-25T13:00Z",
        { name: "Athletic Club", abbreviation: "ATH", score: "2" },
        { name: "Getafe", abbreviation: "GET", score: "0" },
        FINAL
      ),
    ]);
    const later = fixture("2", "sev", "osa", "2026-10-26T20:00:00Z");
    const [played, next] = await withLateScores(
      "la-liga",
      [fixture("1", "ath", "get", "2026-10-25T13:00:00Z"), later],
      TEAMS,
      NOW
    );
    expect(played).toMatchObject({ id: "1", status: "ft", homeScore: 2, awayScore: 0 });
    expect(next).toBe(later);
    expect(String(fetchMock.mock.calls[0][0])).toContain("league=esp.1");
  });

  it("tells two games kicking off together apart by their clubs, either way round", async () => {
    espnAnswers([
      event(
        "e1",
        "2026-10-25T20:00Z",
        { name: "Barcelona", abbreviation: "BAR", score: "3" },
        { name: "Real Madrid", abbreviation: "RMA", score: "1" },
        FINAL
      ),
      event(
        "e2",
        "2026-10-25T20:00Z",
        { name: "Osasuna", abbreviation: "OSA", score: "2" },
        { name: "Sevilla", abbreviation: "SEV", score: "1" },
        FINAL
      ),
    ]);
    const [clasico, swapped] = await withLateScores(
      "la-liga",
      [fixture("1", "fcb", "rma", "2026-10-25T20:00:00Z"), fixture("2", "sev", "osa", "2026-10-25T20:00:00Z")],
      TEAMS,
      NOW
    );
    expect(clasico).toMatchObject({ homeScore: 3, awayScore: 1 });
    // ESPN has Osasuna at home: the score is turned round to football-data's sides.
    expect(swapped).toMatchObject({ homeScore: 1, awayScore: 2 });
  });

  it("carries the live minute, and a shoot-out kept out of the score", async () => {
    espnAnswers([
      event(
        "e1",
        "2026-10-26T02:30Z",
        { name: "Athletic Club", abbreviation: "ATH", score: "1" },
        { name: "Getafe", abbreviation: "GET", score: "1" },
        { name: "STATUS_SECOND_HALF", state: "in", shortDetail: "67'" }
      ),
      event(
        "e2",
        "2026-10-25T20:00Z",
        { name: "Barcelona", abbreviation: "BAR", score: "1", shootoutScore: 4 },
        { name: "Real Madrid", abbreviation: "RMA", score: "1", shootoutScore: 3 },
        { name: "STATUS_FINAL_PEN", state: "post", shortDetail: "FT-Pens" }
      ),
    ]);
    const [live, pens] = await withLateScores(
      "uefa-champions-league",
      [fixture("1", "ath", "get", "2026-10-26T02:30:00Z"), fixture("2", "fcb", "rma", "2026-10-25T20:00:00Z")],
      TEAMS,
      NOW
    );
    expect(live).toMatchObject({ status: "live", minute: 67, homeScore: 1, awayScore: 1 });
    expect(pens).toMatchObject({ status: "pen", homeScore: 1, awayScore: 1, penalties: { home: 4, away: 3 } });
  });

  it("keeps football-data's games as they are when ESPN fails or has no such game", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 }))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const behind = fixture("1", "ath", "get", "2026-10-25T13:00:00Z");
    expect(await withLateScores("la-liga", [behind], TEAMS, NOW)).toEqual([behind]);
    warn.mockRestore();

    espnAnswers([
      event(
        "e9",
        "2026-10-25T18:00Z",
        { name: "Valencia", abbreviation: "VAL", score: "0" },
        { name: "Villarreal", abbreviation: "VIL", score: "0" },
        FINAL
      ),
    ]);
    expect(await withLateScores("la-liga", [behind], TEAMS, NOW)).toEqual([behind]);
  });

  it("leaves a game football-data never settled alone after three days, and a league ESPN is not asked for", async () => {
    const fetchMock = espnAnswers([]);
    await withLateScores("la-liga", [fixture("1", "ath", "get", "2026-10-20T13:00:00Z")], TEAMS, NOW);
    await withLateScores("mls", [fixture("1", "ath", "get", "2026-10-25T13:00:00Z")], TEAMS, NOW);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
