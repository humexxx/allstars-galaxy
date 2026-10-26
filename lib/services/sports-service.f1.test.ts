import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/services/jolpica-f1-service", () => ({
  getF1Data: vi.fn(),
  getF1SeasonWinners: vi.fn(),
}));

import { F1_DATA } from "@/lib/data/sports/f1";
import { getF1Data, getF1SeasonWinners } from "@/lib/services/jolpica-f1-service";
import type { F1Data, F1PastWinner, F1Race } from "@/types/sports";

import { __testing, getF1DashboardHighlight } from "./sports-service";

const { f1Highlight } = __testing;

// Austin 2026: Mexico City is the round after it.
const austin: F1Race = {
  id: "r-19",
  round: 19,
  name: "United States Grand Prix",
  circuit: "Circuit of the Americas",
  circuitId: "americas",
  location: "Austin",
  country: "USA",
  flagEmoji: "🇺🇸",
  date: "2026-10-25",
  startsAt: "2026-10-25T20:00:00.000Z",
  status: "upcoming",
  sessions: [
    { kind: "fp1", startsAt: "2026-10-23T17:30:00.000Z" },
    { kind: "fp2", startsAt: "2026-10-23T21:00:00.000Z" },
    { kind: "fp3", startsAt: "2026-10-24T17:30:00.000Z" },
    { kind: "qualifying", startsAt: "2026-10-24T21:00:00.000Z" },
    { kind: "race", startsAt: "2026-10-25T20:00:00.000Z" },
  ],
};
const singapore: F1Race = {
  ...austin,
  id: "r-18",
  round: 18,
  name: "Singapore Grand Prix",
  circuitId: "marina_bay",
  date: "2026-10-11",
  startsAt: "2026-10-11T12:00:00.000Z",
  sessions: undefined,
  status: "completed",
  podium: ["VER", "LEC", "NOR"],
};
const mexico: F1Race = { ...austin, id: "r-20", round: 20, name: "Mexico City Grand Prix", circuitId: "rodriguez" };

const season = (races: F1Race[]): F1Data => ({ season: 2026, drivers: [], constructors: [], races });
const at = (iso: string): number => Date.parse(iso);
const lastYear = { season: 2025, code: "VER", name: "M. Verstappen", team: "Red Bull" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("f1Highlight", () => {
  it("keeps the race just run, with its winner, on its day and the next on the reader's calendar", () => {
    const run: F1Race = { ...austin, status: "completed", podium: ["NOR", "VER", "LEC"] };
    const data = season([singapore, run, mexico]);
    const costaRica = "America/Costa_Rica";
    // Sunday night in Costa Rica, Monday in UTC: still the race day there.
    expect(f1Highlight(data, at("2026-10-26T04:00:00Z"), costaRica)?.race.id).toBe("r-19");
    // Monday evening: the day after.
    expect(f1Highlight(data, at("2026-10-27T01:00:00Z"), costaRica)?.race.id).toBe("r-19");
    // Tuesday: on to Mexico City.
    expect(f1Highlight(data, at("2026-10-27T14:00:00Z"), costaRica)?.race.id).toBe("r-20");
  });

  it("puts a race on track ahead of the one just run", () => {
    const run: F1Race = { ...singapore, date: "2026-10-24", startsAt: "2026-10-24T12:00:00.000Z" };
    const live: F1Race = { ...mexico, status: "live" };
    expect(f1Highlight(season([run, live]), at("2026-10-25T12:00:00Z"))?.race.id).toBe("r-20");
  });

  it("leads with the next race and says which session comes next, and when", () => {
    const highlight = f1Highlight(season([singapore, austin, mexico]), at("2026-10-24T18:00:00Z"));
    expect(highlight).toEqual({
      season: 2026,
      race: austin,
      liveSession: { kind: "fp3", startsAt: "2026-10-24T17:30:00.000Z" },
      nextSession: { kind: "qualifying", startsAt: "2026-10-24T21:00:00.000Z" },
      nextSessionIn: "in 3h",
    });
  });

  it("works the weekend out from the time it is given, not the feed's", () => {
    const data = season([singapore, austin, mexico]);
    expect(f1Highlight(data, at("2026-10-19T12:00:00Z"))?.nextSessionIn).toBe("in 4d");
    expect(f1Highlight(data, at("2026-10-25T19:30:00Z"))).toMatchObject({
      liveSession: undefined,
      nextSession: { kind: "race" },
      nextSessionIn: "in 30m",
    });
  });

  it("puts the race on now ahead of the next one", () => {
    const live = { ...austin, status: "live" as const };
    const highlight = f1Highlight(season([singapore, live, mexico]), at("2026-10-25T21:00:00Z"));
    expect(highlight?.race.round).toBe(19);
    expect(highlight?.liveSession?.kind).toBe("race");
    expect(highlight?.nextSession).toBeUndefined();
  });

  it("falls back to the last race run once the season is over, with no weekend", () => {
    const highlight = f1Highlight(season([singapore]), at("2026-12-20T12:00:00Z"));
    expect(highlight).toEqual({
      season: 2026,
      race: singapore,
      liveSession: undefined,
      nextSession: undefined,
      nextSessionIn: undefined,
    });
  });

  it("has nothing for a season with no races", () => {
    expect(f1Highlight(season([]), Date.now())).toBeNull();
  });
});

describe("getF1DashboardHighlight", () => {
  it("adds last year's winner at the next race's circuit", async () => {
    vi.mocked(getF1Data).mockResolvedValue(season([singapore, austin, mexico]));
    vi.mocked(getF1SeasonWinners).mockResolvedValue({ americas: lastYear });

    const now = at("2026-10-19T12:00:00Z");
    const highlight = await getF1DashboardHighlight(now);

    // The feed's races as of this request, the same moment the weekend is read at.
    expect(getF1Data).toHaveBeenCalledWith(now);
    expect(getF1SeasonWinners).toHaveBeenCalledWith(2025);
    expect(highlight?.race).toEqual({ ...austin, lastYear });
    expect(highlight?.nextSession?.kind).toBe("fp1");
  });

  it("asks for last season alongside the feed, not after it", async () => {
    let answer: (data: F1Data) => void = () => {};
    vi.mocked(getF1Data).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    vi.mocked(getF1SeasonWinners).mockResolvedValue({ americas: lastYear });

    const pending = getF1DashboardHighlight(at("2026-10-19T12:00:00Z"));
    expect(getF1SeasonWinners).toHaveBeenCalledWith(2025);

    answer(season([austin]));
    expect((await pending)?.race.lastYear).toEqual(lastYear);
    expect(getF1SeasonWinners).toHaveBeenCalledTimes(1);
  });

  it("asks again for the right season when the feed's is not the calendar's", async () => {
    // December, and the feed has moved on to next season's calendar.
    vi.mocked(getF1Data).mockResolvedValue({ ...season([austin]), season: 2027 });
    vi.mocked(getF1SeasonWinners).mockImplementation(
      async (year): Promise<Record<string, F1PastWinner>> =>
        year === 2026 ? { americas: { ...lastYear, season: 2026 } } : {}
    );

    const highlight = await getF1DashboardHighlight(at("2026-12-20T12:00:00Z"));

    expect(vi.mocked(getF1SeasonWinners).mock.calls).toEqual([[2025], [2026]]);
    expect(highlight?.race.lastYear?.season).toBe(2026);
  });

  it("leaves last year out for a circuit new to the calendar", async () => {
    vi.mocked(getF1Data).mockResolvedValue(season([austin]));
    vi.mocked(getF1SeasonWinners).mockResolvedValue({ marina_bay: lastYear });

    const highlight = await getF1DashboardHighlight(at("2026-10-19T12:00:00Z"));

    expect(highlight?.race).toBe(austin);
    expect(highlight?.race.lastYear).toBeUndefined();
  });

  it("names no past winner for a season that is over", async () => {
    vi.mocked(getF1Data).mockResolvedValue(season([singapore]));
    vi.mocked(getF1SeasonWinners).mockResolvedValue({ marina_bay: lastYear });

    const highlight = await getF1DashboardHighlight(at("2026-12-20T12:00:00Z"));

    expect(highlight?.race).toBe(singapore);
  });

  it("names no past winner for the sample season", async () => {
    vi.mocked(getF1Data).mockResolvedValue(F1_DATA);
    vi.mocked(getF1SeasonWinners).mockResolvedValue({ imola: lastYear });

    const highlight = await getF1DashboardHighlight(at("2026-05-20T12:00:00Z"));

    expect(highlight?.race.round).toBe(7);
    expect(highlight?.race.lastYear).toBeUndefined();
  });
});
