import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const caches = vi.hoisted(() => [] as Array<{ keyParts: string[]; revalidate: number }>);

// As the setup's no-op, but recording each cache's key and lifetime.
vi.mock("next/cache", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("next/cache");
  return {
    ...actual,
    unstable_cache: <Args extends unknown[], Ret>(
      fn: (...args: Args) => Ret,
      keyParts: string[],
      options: { revalidate: number }
    ) => {
      caches.push({ keyParts, revalidate: options.revalidate });
      return fn;
    },
  };
});

import { featuredEvent, SURF_DATA } from "@/lib/data/sports/surf";
import type { SurfEvent } from "@/types/sports";

import { __testing, getSurfData } from "./wsl-surf-service";

const fixture = (name: string): string => readFileSync(join(__dirname, "..", "sports", "__fixtures__", name), "utf8");
const SCHEDULE = fixture("wsl-schedule.html");
const PORTUGAL = fixture("wsl-draw-portugal.html");
const PHILIPPINES = fixture("wsl-draw-philippines.html");
const RANKINGS = fixture("wsl-rankings.html");

const page = (body: string, status = 200): Response => new Response(body, { status });

/** The site as saved on 2026-10-25, a page per address; anything else 404s. */
function site(pages: Record<string, string | Response | Promise<Response>>): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async (url: string) => {
    const path = url.replace("https://www.worldsurfleague.com", "");
    const found = pages[path];
    if (found === undefined) return page("", 404);
    return typeof found === "string" ? page(found) : found;
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const SAVED = {
  "/events/2026/ct?all=1": SCHEDULE,
  "/athletes/tour/mct?year=2026": RANKINGS,
  "/events/2026/ct/543/philippines-pro/results?showAll=1&statEventId=5295": PHILIPPINES,
  "/events/2026/ct/445/meo-rip-curl-pro-portugal/results?showAll=1&statEventId=5114": PORTUGAL,
  // Bells's page came back broken; Tahiti and Fiji are not saved (404).
  "/events/2026/ct/436/rip-curl-pro-bells-beach/results?showAll=1&statEventId=5094": page("", 503),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("caching", () => {
  it("keeps the schedule and rankings an hour, a live draw five minutes, a result a week", () => {
    const lifetime = (key: string): number | undefined => caches.find((c) => c.keyParts[0] === key)?.revalidate;
    expect(lifetime("wsl:schedule")).toBe(3_600);
    expect(lifetime("wsl:rankings")).toBe(3_600);
    expect(lifetime("wsl:draw:live")).toBe(300);
    expect(lifetime("wsl:draw")).toBe(3_600);
    expect(lifetime("wsl:final")).toBe(604_800);
  });
});

describe("getSurfData", () => {
  it("reads the season off the site, under its own name and past Next's fetch cache", async () => {
    const spy = site(SAVED);
    const data = await getSurfData();

    expect(data.season).toBe(2026);
    expect(data.events.map((e) => e.name)).toEqual([
      "Rip Curl Pro Bells Beach",
      "Outerknown Tahiti Pro",
      "Fiji Pro",
      "MEO Rip Curl Pro Portugal",
      "Philippines Pro",
    ]);
    expect(data.rankings.map((r) => r.name)).toEqual([
      "Yago Dora",
      "Italo Ferreira",
      "Griffin Colapinto",
      "Liam O'Brien",
    ]);
    for (const [, init] of spy.mock.calls as Array<[string, RequestInit]>) {
      expect(new Headers(init.headers).get("User-Agent")).toBe("AllstarsGalaxy/1.0 (personal sports dashboard)");
      expect(init.cache).toBe("no-store");
    }
  });

  it("features the next stop with its draw, seeds and all, when none is on", async () => {
    site(SAVED);
    const data = await getSurfData();
    expect(data.draw?.eventId).toBe("543");
    expect(data.draw?.rounds[0].heats[0].surfers.map((s) => s.name)).toEqual(["Event seed #16", "Event seed #17"]);
  });

  it("names each finished stop's winner from its own results, and leaves out a result it could not read", async () => {
    site(SAVED);
    const { events } = await getSurfData();
    expect(events.find((e) => e.id === "445")).toMatchObject({
      winner: "Griffin Colapinto",
      runnerUp: "Gabriel Medina",
    });
    for (const id of ["436", "441", "442"]) {
      expect(events.find((e) => e.id === id)?.winner).toBeUndefined();
    }
  });

  it("features the stop on now, its draw on the five-minute cache, and takes its Final off that draw", async () => {
    const live = SCHEDULE.replace(/(meo-rip-curl-pro-portugal[\s\S]*?)event-status--over/, "$1event-status--live");
    const spy = site({ ...SAVED, "/events/2026/ct?all=1": live });
    const data = await getSurfData();

    expect(data.draw?.eventId).toBe("445");
    expect(data.events.find((e) => e.id === "445")).toMatchObject({ status: "live", winner: "Griffin Colapinto" });
    const portugalReads = spy.mock.calls.filter(([url]) => String(url).includes("meo-rip-curl-pro-portugal"));
    expect(portugalReads).toHaveLength(1);
  });

  it("features the last stop surfed once the season is over", async () => {
    const over = SCHEDULE.replace("event-status--upcoming", "event-status--over");
    site({ ...SAVED, "/events/2026/ct?all=1": over });
    const data = await getSurfData();
    expect(data.draw?.eventId).toBe("543");
    expect(data.events.find((e) => e.id === "445")?.winner).toBe("Griffin Colapinto");
  });

  it("keeps the season when the rankings fail", async () => {
    site({ ...SAVED, "/athletes/tour/mct?year=2026": page("", 500) });
    const data = await getSurfData();
    expect(data.events).toHaveLength(5);
    expect(data.rankings).toEqual([]);
  });

  it("leaves the draw out when the featured stop has none yet", async () => {
    site({ ...SAVED, "/events/2026/ct/543/philippines-pro/results?showAll=1&statEventId=5295": "<html></html>" });
    const data = await getSurfData();
    expect(data.draw).toBeUndefined();
    expect("draw" in data).toBe(false);
  });

  it("hands over to the sample season when the schedule cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline")))
    );
    expect(await getSurfData()).toBe(SURF_DATA);

    site({ "/events/2026/ct?all=1": page("", 503) });
    expect(await getSurfData()).toBe(SURF_DATA);
  });

  it("reads last season while this one lists no stops, and gives up when neither does", async () => {
    const lastSeason = SCHEDULE.replaceAll("/events/2026/", "/events/2025/");
    const spy = site({ "/events/2026/ct?all=1": "<html>No events</html>", "/events/2025/ct?all=1": lastSeason });
    const data = await getSurfData();
    expect(data.season).toBe(2025);
    expect(data.events[0].startDate).toBe("2025-04-01");
    expect(spy.mock.calls.map(([url]) => url)).toContain("https://www.worldsurfleague.com/athletes/tour/mct?year=2025");

    site({ "/events/2026/ct?all=1": "<html>No events</html>" });
    expect(await getSurfData()).toBe(SURF_DATA);
  });

  it("takes this season's address serving last season's stops as no stops, and reads last season", async () => {
    const lastSeason = SCHEDULE.replaceAll("/events/2026/", "/events/2025/");
    site({ "/events/2026/ct?all=1": lastSeason, "/events/2025/ct?all=1": lastSeason });
    const data = await getSurfData();
    expect(data.season).toBe(2025);
    expect(data.events[0].startDate).toBe("2025-04-01");
  });

  it("keeps the last good schedule rather than reading a stop's unreadable status as upcoming", async () => {
    site({ ...SAVED, "/events/2026/ct?all=1": SCHEDULE.replaceAll("event-status--", "event-state--") });
    expect(await getSurfData()).toBe(SURF_DATA);
  });

  it("stops waiting once the upstream budget is spent, and keeps what came back", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    let abort = (): void => undefined;
    const hung = new Promise<Response>((_, reject) => {
      abort = () => reject(new Error("aborted"));
    });
    hung.catch(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = url.replace("https://www.worldsurfleague.com", "");
        return path === "/events/2026/ct?all=1" ? page(SCHEDULE) : hung;
      })
    );
    const pending = getSurfData();
    await vi.advanceTimersByTimeAsync(8_000);
    const data = await pending;
    expect(data.season).toBe(2026);
    expect(data.events).toHaveLength(5);
    expect(data.draw).toBeUndefined();
    expect(data.rankings).toEqual([]);

    // Let the abandoned reads fail, as their own timeouts would, freeing the queue.
    abort();
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  });

  it("leaves out only the piece still out when the budget is spent", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    let abort = (): void => undefined;
    const hung = new Promise<Response>((_, reject) => {
      abort = () => reject(new Error("aborted"));
    });
    hung.catch(() => undefined);
    site({ ...SAVED, "/events/2026/ct/436/rip-curl-pro-bells-beach/results?showAll=1&statEventId=5094": hung });
    const pending = getSurfData();
    await vi.advanceTimersByTimeAsync(8_000);
    const data = await pending;
    expect(data.rankings).toHaveLength(4);
    expect(data.draw?.eventId).toBe("543");
    expect(data.events.find((e) => e.id === "445")?.winner).toBe("Griffin Colapinto");
    expect(data.events.find((e) => e.id === "436")?.winner).toBeUndefined();

    abort();
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  });
});

describe("the uncached reads", () => {
  const { fetchDraw, fetchRankings, fetchFinal, resultsPath, withFinals } = __testing;

  it("refuses an empty ranking once a stop has been surfed, and accepts it before", async () => {
    site({ "/athletes/tour/mct?year=2026": "<table></table>" });
    await expect(fetchRankings(2026, true)).rejects.toThrow("no rankings");
    await expect(fetchRankings(2026, false)).resolves.toEqual([]);
  });

  it("refuses an empty draw for a stop under way or over, and accepts it for one to come", async () => {
    site({ "/events/2026/ct/445/meo-rip-curl-pro-portugal/results?showAll=1&statEventId=5114": "<html></html>" });
    await expect(fetchDraw(2026, "445", "meo-rip-curl-pro-portugal", "5114", true)).rejects.toThrow("no heats");
    await expect(fetchDraw(2026, "445", "meo-rip-curl-pro-portugal", "5114", false)).resolves.toEqual({
      eventId: "445",
      rounds: [],
    });
  });

  it("reads a Final, no Final as nothing, and throws only on a page it cannot read", async () => {
    site(SAVED);
    await expect(fetchFinal(2026, "445", "meo-rip-curl-pro-portugal", "5114")).resolves.toEqual({
      winner: "Griffin Colapinto",
      runnerUp: "Gabriel Medina",
    });
    await expect(fetchFinal(2026, "543", "philippines-pro", "5295")).resolves.toBeNull();
    await expect(fetchFinal(2026, "436", "rip-curl-pro-bells-beach", "5094")).rejects.toThrow("503");
  });

  it("asks for the men's whole draw, every round on one page", () => {
    expect(resultsPath(2026, "445", "meo-rip-curl-pro-portugal", "5114")).toBe(
      "/events/2026/ct/445/meo-rip-curl-pro-portugal/results?showAll=1&statEventId=5114"
    );
    expect(resultsPath(2026, "445", "meo-rip-curl-pro-portugal", "")).toBe(
      "/events/2026/ct/445/meo-rip-curl-pro-portugal/results?showAll=1"
    );
  });

  it("joins a winner in without touching the stops that have none, and drops the stat event id", () => {
    const stop = { ...SURF_DATA.events[3], statEventId: "5114" };
    const [joined] = withFinals([stop], new Map([[stop.id, { winner: "A" }]]));
    expect(joined).toMatchObject({ winner: "A" });
    expect(joined).not.toHaveProperty("runnerUp");
    expect(joined).not.toHaveProperty("statEventId");
    expect(withFinals([stop], new Map())[0]).toEqual(SURF_DATA.events[3]);
  });
});

describe("the read queue", () => {
  const { fetchRankings, MAX_IN_FLIGHT } = __testing;

  it("keeps at most four pages in flight, and hands a freed slot to the next in line", async () => {
    const answers: Array<() => void> = [];
    const started: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        started.push(url);
        return new Promise<Response>((resolve) => answers.push(() => resolve(page(RANKINGS))));
      })
    );
    const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    const reads = Array.from({ length: 6 }, (_, i) => fetchRankings(2020 + i, true));
    await flush();
    expect(MAX_IN_FLIGHT).toBe(4);
    expect(started).toHaveLength(4);

    answers[0]();
    await flush();
    expect(started).toHaveLength(5);
    expect(started[4]).toContain("year=2024");

    for (const answer of answers.slice(1)) answer();
    await flush();
    answers[5]?.();
    const results = await Promise.all(reads);
    expect(started).toHaveLength(6);
    expect(results.every((r) => r.length === 4)).toBe(true);
  });
});

describe("featuredEvent", () => {
  const event = (id: string, status: SurfEvent["status"]): SurfEvent => ({
    id,
    slug: id,
    name: id,
    location: "",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    status,
    stop: 1,
  });

  it("leads with the event on now, else the next, else the last one surfed", () => {
    expect(featuredEvent([event("a", "completed"), event("b", "live"), event("c", "upcoming")])?.id).toBe("b");
    expect(featuredEvent([event("a", "completed"), event("c", "upcoming"), event("d", "upcoming")])?.id).toBe("c");
    expect(featuredEvent([event("a", "completed"), event("b", "completed")])?.id).toBe("b");
    expect(featuredEvent([])).toBeUndefined();
  });
});
