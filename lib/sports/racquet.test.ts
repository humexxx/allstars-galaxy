import { describe, expect, it } from "vitest";

import type { BracketMatch, BracketRound, RacquetTournament } from "@/types/sports";

import {
  addDays,
  clampDay,
  currentTournament,
  drawIsOut,
  drawsShipped,
  featuredTournament,
  justFinished,
  playLine,
  statusByDates,
} from "./racquet";

type Dated = Pick<RacquetTournament, "id" | "status" | "startDate" | "endDate">;

const t = (
  id: string,
  status: RacquetTournament["status"],
  startDate: string,
  endDate: string
): Dated => ({ id, status, startDate, endDate });

// October 2026 as Premier Padel had it: Milano just finished, Kuwait next.
const SEASON = [
  t("paris", "completed", "2026-09-28", "2026-10-04"),
  t("dubai", "completed", "2026-10-05", "2026-10-11"),
  t("milano", "completed", "2026-10-12", "2026-10-18"),
  t("kuwait", "upcoming", "2026-10-26", "2026-10-31"),
  t("mexico", "upcoming", "2026-11-09", "2026-11-15"),
  t("barcelona", "upcoming", "2026-11-23", "2026-11-29"),
  t("finals", "upcoming", "2026-12-14", "2026-12-20"),
];

const withLive = (id: string): Dated[] =>
  SEASON.map((x) => (x.id === id ? { ...x, status: "live" as const } : x));

describe("featuredTournament", () => {
  it("is the next to start while nothing is on", () => {
    expect(featuredTournament(SEASON)?.id).toBe("kuwait");
  });

  it("is the one being played when there is one", () => {
    expect(featuredTournament(withLive("milano"))?.id).toBe("milano");
  });

  it("is nothing once the season is over", () => {
    expect(featuredTournament(SEASON.filter((x) => x.status === "completed"))).toBeUndefined();
  });
});

describe("currentTournament", () => {
  it("is the one just finished while nothing is on", () => {
    expect(currentTournament(SEASON)?.id).toBe("milano");
  });

  it("is the one being played when there is one", () => {
    expect(currentTournament(withLive("kuwait"))?.id).toBe("kuwait");
  });
});

describe("justFinished", () => {
  it("lists the latest finals first", () => {
    expect(justFinished(SEASON, 2).map((x) => x.id)).toEqual(["milano", "dubai"]);
  });

  it("keeps the list's own order on the same final day: the bigger draw first", () => {
    const week = [
      t("shanghai", "completed", "2026-10-05", "2026-10-18"),
      t("almaty", "completed", "2026-10-12", "2026-10-18"),
    ];
    expect(justFinished(week, 2).map((x) => x.id)).toEqual(["shanghai", "almaty"]);
  });
});

describe("drawsShipped", () => {
  it("is the featured and the current tournament", () => {
    expect([...drawsShipped(SEASON)].sort()).toEqual(["kuwait", "milano"]);
  });

  it("is one draw when the featured one is being played", () => {
    expect([...drawsShipped(withLive("kuwait"))]).toEqual(["kuwait"]);
  });
});

describe("drawIsOut", () => {
  it("looks for a pending draw only in the days before it starts", () => {
    expect(drawIsOut("upcoming", "2026-10-26", "2026-10-18")).toBe(false);
    expect(drawIsOut("upcoming", "2026-10-21", "2026-10-18")).toBe(true);
    expect(drawIsOut("live", "2026-10-12", "2026-10-18")).toBe(true);
    expect(drawIsOut("completed", "2026-10-12", "2026-10-18")).toBe(true);
  });
});

describe("statusByDates", () => {
  it("places an event by its days against today", () => {
    expect(statusByDates("2026-10-12", "2026-10-18", "2026-10-19")).toBe("completed");
    expect(statusByDates("2026-10-12", "2026-10-18", "2026-10-18")).toBe("live");
    expect(statusByDates("2026-10-26", "2026-10-31", "2026-10-18")).toBe("upcoming");
  });
});

describe("clampDay / addDays", () => {
  it("moves a day inside an event's days", () => {
    expect(clampDay("2026-10-19", "2026-10-12", "2026-10-18")).toBe("2026-10-18");
    expect(clampDay("2026-10-01", "2026-10-12", "2026-10-18")).toBe("2026-10-12");
    expect(clampDay("2026-10-15", "2026-10-12", "2026-10-18")).toBe("2026-10-15");
  });

  it("counts calendar days across a month and a year", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2027-01-02", -45)).toBe("2026-11-18");
  });
});

describe("playLine", () => {
  const live = { ...t("turin", "live", "2026-11-15", "2026-11-22"), name: "ATP Finals", location: "Turin" };
  const tie = (id: string, extra: Partial<BracketMatch> = {}): BracketMatch => ({
    id,
    homeTeamId: `${id}-a`,
    awayTeamId: `${id}-b`,
    ...extra,
  });
  const semis = (...matches: BracketMatch[]): BracketRound[] => [
    { id: "semi-final", label: "Semi-finals", matches },
    { id: "final", label: "Final", matches: [{ id: "f", homeTeamId: null, awayTeamId: null }] },
  ];

  it("says when a tournament still to start starts", () => {
    expect(playLine({ ...live, status: "upcoming" }, undefined, "2026-11-14")).toBe("Starts tomorrow");
  });

  it("names the stage played before the draw while there is no round to name", () => {
    expect(playLine({ ...live, stageInPlay: "Group stage" }, undefined, "2026-11-15")).toBe("Group stage under way");
  });

  it("calls a round next while its ties have two names and nothing played", () => {
    expect(playLine(live, semis(tie("s1"), tie("s2")), "2026-11-15")).toBe("Semi-finals next");
  });

  it("calls a round under way once a tie in it is decided or has a score", () => {
    expect(playLine(live, semis(tie("s1", { winnerTeamId: "s1-a" }), tie("s2")), "2026-11-21")).toBe(
      "Semi-finals under way"
    );
    expect(
      playLine(live, semis(tie("s1", { legs: [{ homeScore: 3, awayScore: 2 }] }), tie("s2")), "2026-11-21")
    ).toBe("Semi-finals under way");
  });

  it("says nothing with no draw, or with every tie decided", () => {
    expect(playLine(live, undefined, "2026-11-15")).toBeNull();
    expect(playLine(live, [{ id: "final", label: "Final", matches: [tie("f", { winnerTeamId: "f-a" })] }], "2026-11-22")).toBeNull();
  });
});
