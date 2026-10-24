import { describe, expect, it } from "vitest";

import type { RacquetTournament } from "@/types/sports";

import {
  addDays,
  clampDay,
  currentTournament,
  drawIsOut,
  drawsShipped,
  featuredTournament,
  justFinished,
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
