import "server-only";

import { featuredEvent, SURF_DATA } from "@/lib/data/sports/surf";
import {
  parseDraw,
  parseRankings,
  parseSchedule,
  winnerOf,
  type WslEvent,
} from "@/lib/sports/wsl-parse";
import type { SurfData, SurfDraw, SurfEvent, SurfFinal, SurfRanking } from "@/types/sports";

import { cachedFeed, UPSTREAM_TIMEOUT_MS, upstreamSignal } from "./upstream";

/**
 * The men's Championship Tour off the World Surf League's own pages — no
 * other source carries its heats (ESPN, TheSportsDB and Liveheats have
 * nothing for it). The owner chose this source knowing the WSL's terms
 * discourage automated reading, so it is read gently: an honest User-Agent,
 * a few pages in flight at most, and every page mapped before it is cached.
 * The pages are about a megabyte each, mostly inline CSS.
 */

const SITE = "https://www.worldsurfleague.com";
const USER_AGENT = "AllstarsGalaxy/1.0 (personal sports dashboard)";
const HOUR_SECONDS = 3_600;
const LIVE_DRAW_SECONDS = 300;
/** A settled stop's result never changes. */
const RESULT_SECONDS = 7 * 86_400;
/** How long past its waiting period a stop's results page is taken as final. */
const SETTLED_MS = 2 * 86_400_000;
const TAGS = ["sports:surf"];
const MAX_IN_FLIGHT = 4;

let inFlight = 0;
const waiting: Array<() => void> = [];

/**
 * At most `MAX_IN_FLIGHT` pages at once: a cold start reads the schedule,
 * then the rankings, the featured draw and every finished stop's result
 * together — a dozen pages in one burst otherwise. A freed slot passes
 * straight to the next in line, so a newcomer never slips in past the cap.
 */
async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_IN_FLIGHT) inFlight++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await run();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

/**
 * One page's HTML, never through Next's fetch cache (only the mapped result
 * is cached). The timeout starts before the queue, so time spent waiting for
 * a slot counts against the same ceiling. `missingIsEmpty` reads a 404 as an
 * empty page: next season's schedule before the WSL has published it.
 */
async function fetchPage(
  path: string,
  { missingIsEmpty = false, signal = upstreamSignal() }: { missingIsEmpty?: boolean; signal?: AbortSignal } = {}
): Promise<string> {
  return withSlot(async () => {
    const res = await fetch(`${SITE}${path}`, {
      signal,
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (missingIsEmpty && res.status === 404) return "";
    if (!res.ok) throw new Error(`wsl ${res.status} on ${path}`);
    return res.text();
  });
}

function schedulePath(year: number): string {
  return `/events/${year}/ct?all=1`;
}

function rankingsPath(year: number): string {
  return `/athletes/tour/mct?year=${year}`;
}

/**
 * The whole draw, every round on one page. A joint event's page holds the
 * men's and the women's heats; the stat event id picks the men's, as the
 * site's own links do, rather than trusting which one the page opens on.
 */
function resultsPath(year: number, eventId: string, slug: string, statEventId: string): string {
  const base = `/events/${year}/ct/${encodeURIComponent(eventId)}/${encodeURIComponent(slug)}/results?showAll=1`;
  return statEventId ? `${base}&statEventId=${encodeURIComponent(statEventId)}` : base;
}

type SurfSeason = { season: number; events: WslEvent[] };

/**
 * The season's stops, the previous season's while the new one lists none —
 * in January the next tour may not be published yet. Throws when neither
 * lists a stop, so the cache keeps its last good schedule. One timeout covers
 * both reads.
 */
async function fetchSchedule(year: number): Promise<SurfSeason> {
  const signal = upstreamSignal();
  for (const season of [year, year - 1]) {
    const events = parseSchedule(await fetchPage(schedulePath(season), { missingIsEmpty: true, signal }), season);
    if (events.length > 0) return { season, events };
  }
  throw new Error(`wsl: no Championship Tour stops listed for ${year} or ${year - 1}`);
}

/**
 * The season's ranking. Before the first stop is surfed an empty table is the
 * truth; after it, an empty one is a page that failed to read.
 */
async function fetchRankings(season: number, surfed: boolean): Promise<SurfRanking[]> {
  const rankings = parseRankings(await fetchPage(rankingsPath(season)));
  if (rankings.length === 0 && surfed) throw new Error(`wsl: no rankings read for ${season}`);
  return rankings;
}

/**
 * A stop's draw. Only a stop still to come may have none: for one under way
 * or over, an empty draw is a page that failed to read (maintenance, a new
 * layout) and must not replace the last good one.
 */
async function fetchDraw(
  season: number,
  eventId: string,
  slug: string,
  statEventId: string,
  expectHeats: boolean
): Promise<SurfDraw> {
  const draw = parseDraw(await fetchPage(resultsPath(season, eventId, slug, statEventId)), eventId);
  if (draw.rounds.length === 0 && expectHeats) throw new Error(`wsl: no heats read for event ${eventId}`);
  return draw;
}

/**
 * A finished stop's Final, or null when its page reads but holds none (a
 * stop called off before it). Throws only when the page cannot be read.
 */
async function fetchFinal(
  season: number,
  eventId: string,
  slug: string,
  statEventId: string
): Promise<SurfFinal | null> {
  return winnerOf(await fetchDraw(season, eventId, slug, statEventId, true));
}

const getSchedule = cachedFeed<[number], SurfSeason | null>(
  "wsl schedule",
  fetchSchedule,
  () => null,
  ["wsl:schedule"],
  { revalidate: HOUR_SECONDS, tags: TAGS }
);

const getRankings = cachedFeed<[number, boolean], SurfRanking[] | null>(
  "wsl rankings",
  fetchRankings,
  () => null,
  ["wsl:rankings"],
  { revalidate: HOUR_SECONDS, tags: TAGS }
);

type DrawArgs = [number, string, string, string, boolean];

/** A draw being surfed changes by the heat; any other, by the hour at most. */
const getLiveDraw = cachedFeed<DrawArgs, SurfDraw | null>("wsl draw", fetchDraw, () => null, ["wsl:draw:live"], {
  revalidate: LIVE_DRAW_SECONDS,
  tags: TAGS,
});

const getDraw = cachedFeed<DrawArgs, SurfDraw | null>("wsl draw", fetchDraw, () => null, ["wsl:draw"], {
  revalidate: HOUR_SECONDS,
  tags: TAGS,
});

/** A settled stop's Final, or that it has none, kept a week. */
const getFinal = cachedFeed<[number, string, string, string], SurfFinal | null>(
  "wsl result",
  fetchFinal,
  () => null,
  ["wsl:final"],
  { revalidate: RESULT_SECONDS, tags: TAGS }
);

function drawFor(season: number, event: WslEvent): Promise<SurfDraw | null> {
  const read = event.status === "live" ? getLiveDraw : getDraw;
  return read(season, event.id, event.slug, event.statEventId ?? "", event.status !== "upcoming");
}

/**
 * A finished stop's winner. Two days past its waiting period its page is
 * taken as final, Final or none, and kept a week; until then it is read off
 * the hourly draw, so a Final the site has yet to post costs a read an hour.
 */
async function finalFor(season: number, event: WslEvent): Promise<SurfFinal | null> {
  const stat = event.statEventId ?? "";
  if (Date.parse(`${event.endDate}T00:00:00Z`) + SETTLED_MS < Date.now()) {
    return getFinal(season, event.id, event.slug, stat);
  }
  const draw = await getDraw(season, event.id, event.slug, stat, true);
  return draw && winnerOf(draw);
}

function withFinals(events: WslEvent[], finals: Map<string, SurfFinal>): SurfEvent[] {
  return events.map(({ statEventId, ...event }): SurfEvent => {
    void statEventId;
    const final = finals.get(event.id);
    return final ? { ...event, winner: final.winner, ...(final.runnerUp ? { runnerUp: final.runnerUp } : {}) } : event;
  });
}

function settled<T>(result: PromiseSettledResult<T>): T | undefined {
  return result.status === "fulfilled" ? result.value : undefined;
}

/**
 * `promise`'s value, or undefined once `ms` have passed. The read carries on
 * and fills its cache for the next render; this one just stops waiting.
 */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), Math.max(0, ms));
  });
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The season: its stops with every finished one's winner and runner-up, the
 * featured stop's draw (on now, else next, else the last surfed) and the
 * rankings.
 *
 * Each piece through its own cache, read out here rather than inside one
 * cached function — Next skips the read of an `unstable_cache` nested in
 * another, so a week-long result cache would never have served. Only an
 * unreadable schedule gives up (the sample season takes over); a missing
 * draw, ranking or result leaves just that piece out. The featured stop's
 * Final, once surfed, comes off the draw already read.
 *
 * A cold render reads the schedule and then a dozen pages behind the queue,
 * so the whole render shares one upstream budget: whatever has not come back
 * by then is left out of this render. The rankings and the draw are asked
 * for first, so they take the first slots.
 */
export async function getSurfData(): Promise<SurfData> {
  const started = Date.now();
  const schedule = await getSchedule(new Date().getUTCFullYear());
  if (!schedule) return SURF_DATA;
  const { season, events } = schedule;
  const featured = featuredEvent(events);
  const finished = events.filter((e) => e.status === "completed" && e.id !== featured?.id);

  const pieces = Promise.allSettled([
    getRankings(
      season,
      events.some((e) => e.status === "completed")
    ),
    featured ? drawFor(season, featured) : Promise.resolve(null),
    Promise.allSettled(finished.map((e) => finalFor(season, e))),
  ]);
  const [rankings, draw, results] = (await within(pieces, UPSTREAM_TIMEOUT_MS - (Date.now() - started))) ?? [];

  const finals = new Map<string, SurfFinal>();
  ((results && settled(results)) ?? []).forEach((result, i) => {
    const final = settled(result);
    if (final) finals.set(finished[i].id, final);
  });
  const featuredDraw = draw && settled(draw);
  const shown = featuredDraw && featuredDraw.rounds.length > 0 ? featuredDraw : undefined;
  const featuredFinal = shown && winnerOf(shown);
  if (featured && featuredFinal) finals.set(featured.id, featuredFinal);

  return {
    season,
    events: withFinals(events, finals),
    ...(shown ? { draw: shown } : {}),
    rankings: (rankings && settled(rankings)) ?? [],
  };
}

/** Pure helpers and the uncached reads, exported for their tests. */
export const __testing = {
  USER_AGENT,
  schedulePath,
  rankingsPath,
  resultsPath,
  withFinals,
  fetchSchedule,
  fetchRankings,
  fetchDraw,
  fetchFinal,
  MAX_IN_FLIGHT,
};
