import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/padel-api-service", () => ({ getPadelData: vi.fn(), getPadelDraw: vi.fn() }));
vi.mock("@/lib/services/espn-tennis-service", () => ({ getTennisData: vi.fn(), getTennisDraw: vi.fn() }));
vi.mock("@/lib/services/jolpica-f1-service", () => ({ getF1Data: vi.fn(), getF1RaceClassification: vi.fn() }));
vi.mock("@/lib/services/openf1-service", () => ({ getF1WeekendResults: vi.fn() }));
vi.mock("@/lib/utils/request-today", () => ({ getRequestTodayIso: vi.fn(async () => "2026-10-18") }));

import { F1_SEASON } from "@/components/entertainment/sports/__fixtures__/f1";
import { getTennisData } from "@/lib/services/espn-tennis-service";
import { getF1Data, getF1RaceClassification } from "@/lib/services/jolpica-f1-service";
import { getF1WeekendResults } from "@/lib/services/openf1-service";
import { getPadelData, getPadelDraw } from "@/lib/services/padel-api-service";
import type { RacquetData, RacquetDraw, RacquetTournament } from "@/types/sports";

import { loadF1Race, loadRacquetTournament } from "./detail";

const tournament = (id: string, status: RacquetTournament["status"], startDate: string, extra: Partial<RacquetTournament> = {}): RacquetTournament => ({
  id,
  name: id,
  location: "—",
  startDate,
  endDate: startDate,
  status,
  ...extra,
});

const MEN: RacquetData = {
  tour: "wpt-men",
  season: 2026,
  rankings: [],
  tournaments: [
    tournament("padelapi-747", "completed", "2026-10-12", {
      bracket: [{ id: "final", label: "Final", matches: [{ id: "f", homeTeamId: "a", awayTeamId: "b" }] }],
    }),
    tournament("padelapi-746", "completed", "2026-10-05"),
    tournament("padelapi-749", "upcoming", "2026-11-09"),
    tournament("wpt-m-doha", "completed", "2026-02-23"),
  ],
  calendar: [{ id: "padelapi-701", name: "Madrid P1 2026", startDate: "2026-04-06", endDate: "2026-04-12", status: "completed" }],
  drawPlayers: [],
};

const DRAW: RacquetDraw = { tournamentId: "padelapi-746", rounds: [], players: [] };

beforeEach(() => {
  vi.mocked(getPadelData).mockResolvedValue({ men: MEN });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("loadRacquetTournament", () => {
  it("hands over the draw the feed shipped without asking the provider", async () => {
    const detail = await loadRacquetTournament("padel", "padelapi-747");
    expect(detail?.draw).toMatchObject({ status: "ready", draw: { rounds: [{ id: "final" }] } });
    expect(getPadelDraw).not.toHaveBeenCalled();
  });

  it("reads any other draw through the provider's cache", async () => {
    vi.mocked(getPadelDraw).mockResolvedValue(DRAW);
    const detail = await loadRacquetTournament("padel", "padelapi-746");
    expect(getPadelDraw).toHaveBeenCalledWith("padelapi-746");
    expect(detail).toMatchObject({ draw: { status: "ready", draw: DRAW }, today: "2026-10-18" });
  });

  it("says the draw failed when the provider did not answer", async () => {
    vi.mocked(getPadelDraw).mockResolvedValue(null);
    expect((await loadRacquetTournament("padel", "padelapi-746"))?.draw).toEqual({ status: "error" });
  });

  it("finds a tournament on the season's calendar alone", async () => {
    vi.mocked(getPadelDraw).mockResolvedValue(DRAW);
    expect((await loadRacquetTournament("padel", "padelapi-701"))?.tournament.name).toBe("Madrid P1 2026");
  });

  it("asks nobody for a draw weeks before it can exist, nor for a fixture's", async () => {
    expect((await loadRacquetTournament("padel", "padelapi-749"))?.draw).toEqual({ status: "pending" });
    expect((await loadRacquetTournament("padel", "wpt-m-doha"))?.draw).toEqual({ status: "unavailable" });
    expect(getPadelDraw).not.toHaveBeenCalled();
  });

  it("is null for a tournament the tour does not list", async () => {
    expect(await loadRacquetTournament("padel", "padelapi-999")).toBeNull();
  });

  it("reads tennis from the ATP", async () => {
    vi.mocked(getTennisData).mockResolvedValue({ atp: { ...MEN, tour: "atp" } });
    expect((await loadRacquetTournament("tennis", "padelapi-747"))?.tournament.id).toBe("padelapi-747");
    expect(getPadelData).not.toHaveBeenCalled();
  });
});

describe("loadF1Race", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    vi.mocked(getF1Data).mockResolvedValue(F1_SEASON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads a race run with its sessions and its whole field", async () => {
    vi.mocked(getF1WeekendResults).mockResolvedValue({ season: 2026, round: 17, sessions: [{ kind: "fp1", rows: [] }] });
    vi.mocked(getF1RaceClassification).mockResolvedValue({ season: 2026, round: 17, rows: [] });
    const detail = await loadF1Race(17);
    expect(detail).toMatchObject({ race: { round: 17 }, current: false, sessions: [{ kind: "fp1" }], classification: [] });
    expect(getF1RaceClassification).toHaveBeenCalledWith(2026, 17);
  });

  it("says the field is not in yet when Jolpica has none", async () => {
    vi.mocked(getF1WeekendResults).mockResolvedValue({ season: 2026, round: 17, sessions: [] });
    vi.mocked(getF1RaceClassification).mockResolvedValue(null);
    expect((await loadF1Race(17))?.classification).toBeNull();
  });

  it("asks for nothing of a weekend still to start, and marks the race next", async () => {
    const detail = await loadF1Race(18);
    expect(detail).toMatchObject({ current: true, sessions: [] });
    expect(detail?.classification).toBeUndefined();
    expect(getF1WeekendResults).not.toHaveBeenCalled();
    expect(getF1RaceClassification).not.toHaveBeenCalled();
  });

  it("is null for a round the season does not have", async () => {
    expect(await loadF1Race(39)).toBeNull();
  });
});
