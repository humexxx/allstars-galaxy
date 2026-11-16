import "server-only";

import type { FootballLeagueId, NewsStory } from "@/types/sports";

import { cachedFeed, upstreamSignal } from "./upstream";

/** ESPN's site API, the one espn.com reads: no key. */
const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const REVALIDATE_SECONDS = 900;
/** A day's worth on a busy one: an NBA night is a recap a game. */
const LIMIT = 24;

/** Every wire a News tab reads, by the hub's own names. */
type NewsFeed = "nba" | "nfl" | "mlb" | "nhl" | "atp" | FootballLeagueId;

/** A wire's league, and the edition to ask for when it is not espn.com's own. */
type FeedSource = { path: string; params?: Record<string, string> };

const FEEDS: Record<NewsFeed, FeedSource> = {
  nba: { path: "basketball/nba" },
  nfl: { path: "football/nfl" },
  mlb: { path: "baseball/mlb" },
  nhl: { path: "hockey/nhl" },
  atp: { path: "tennis/atp" },
  "premier-league": { path: "soccer/eng.1" },
  "la-liga": { path: "soccer/esp.1" },
  "serie-a": { path: "soccer/ita.1" },
  "ligue-1": { path: "soccer/fra.1" },
  bundesliga: { path: "soccer/ger.1" },
  mls: { path: "soccer/usa.1" },
  // espn.com's English wire for the league stopped in 2023 (seen October
  // 2026); ESPN's Costa Rican edition, in Spanish, still writes about it.
  "costa-rica": { path: "soccer/crc.1", params: { lang: "es", region: "cr" } },
  "uefa-champions-league": { path: "soccer/uefa.champions" },
  "world-cup": { path: "soccer/fifa.world" },
};

function newsUrl(feed: NewsFeed): string {
  const { path, params } = FEEDS[feed];
  const query = new URLSearchParams({ limit: String(LIMIT), ...params });
  return `${BASE_URL}/${path}/news?${query}`;
}

type EspnImage = { type?: string; url?: string; width?: number; height?: number; alt?: string; caption?: string };

type EspnArticle = {
  id?: number | string;
  type?: string;
  headline?: string;
  description?: string;
  published?: string;
  premium?: boolean;
  images?: EspnImage[];
  links?: { web?: { href?: string } };
  categories?: Array<{ type?: string; description?: string }>;
};

/**
 * The picture to show: a photograph, the widest. A recap's own images are
 * "stitcher" pictures — the two teams' logos composed on a card — which say
 * less than no picture at all.
 */
function pictureOf(images: EspnImage[] | undefined): NewsStory["image"] {
  const photos = (images ?? []).filter((i) => i.url && i.type !== "stitcher");
  if (photos.length === 0) return null;
  const best = photos.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a));
  return { url: best.url!, ...(best.alt || best.caption ? { alt: best.alt || best.caption } : {}) };
}

function kindOf(type: string | undefined): NewsStory["kind"] {
  if (type === "Media") return "video";
  if (type === "Recap") return "recap";
  return "story";
}

/**
 * One article as a story, or null for what a reader could not open: ESPN+
 * (behind a paywall), or nothing to link to.
 */
function storyFrom(article: EspnArticle): NewsStory | null {
  const href = article.links?.web?.href;
  if (article.premium || !article.id || !article.headline || !href || !article.published) return null;
  return {
    id: `espn-${article.id}`,
    headline: article.headline,
    description: article.description?.trim() || null,
    href: href.replace(/^http:/, "https:"),
    external: true,
    image: pictureOf(article.images),
    at: article.published,
    kind: kindOf(article.type),
    about: (article.categories ?? [])
      .filter((c) => (c.type === "team" || c.type === "athlete") && c.description)
      .map((c) => c.description!),
  };
}

/** espn.com's desk for each wire: the first step of a story's address. */
const DESKS = ["nba", "nfl", "mlb", "nhl", "tennis", "soccer"] as const;

/** Desks no wire here reads, whose stories ESPN cross-files all the same. */
const OTHER_DESKS = [
  "wnba",
  "college-football",
  "mens-college-basketball",
  "womens-college-basketball",
  "golf",
  "f1",
  "racing",
  "mma",
  "boxing",
  "cricket",
  "rugby",
  "olympics",
];

function deskOf(feed: NewsFeed): (typeof DESKS)[number] {
  if (feed === "atp") return "tennis";
  return feed === "nba" || feed === "nfl" || feed === "mlb" || feed === "nhl" ? feed : "soccer";
}

/** Where espn.com filed a story: "nba" of espn.com/nba/story/…, "betting" of /espn/betting/…. */
function filedUnder(story: NewsStory): string {
  const [first = "", second = ""] = story.href.replace(/^https?:\/\/[^/]+\//, "").split("/");
  return first === "espn" ? second : first;
}

/**
 * A wire in the order worth reading: the league's own stories first, newest
 * first, then its asides — the fantasy and betting desks' pieces — newest
 * first too. A re-ordering, not a filter, with one exception: a story ESPN
 * filed under another sport's desk (the NBA wire carries a soccer story when
 * a striker copies a point guard's celebration) is dropped. Anything filed
 * elsewhere — a clip, a general story, another edition's "futbol" — counts
 * as the league's own, so an address ESPN changes costs the order, never a
 * story.
 */
function inReadingOrder(feed: NewsFeed, stories: NewsStory[]): NewsStory[] {
  const own = deskOf(feed);
  const elsewhere = new Set<string>([...DESKS.filter((d) => d !== own), ...OTHER_DESKS]);
  const aside = (s: NewsStory): number => (/^(fantasy|betting)$/.test(filedUnder(s)) ? 1 : 0);
  return stories
    .filter((s) => !elsewhere.has(filedUnder(s)))
    .sort((a, b) => aside(a) - aside(b) || b.at.localeCompare(a.at));
}

/** A league's or a tour's latest news, each story once, in reading order. */
async function fetchNews(feed: NewsFeed): Promise<NewsStory[]> {
  const res = await fetch(newsUrl(feed), { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`espn news ${res.status} for ${feed}`);
  const json = (await res.json()) as { articles?: EspnArticle[] };
  const byId = new Map<string, NewsStory>();
  for (const article of json.articles ?? []) {
    const story = storyFrom(article);
    if (story && !byId.has(story.id)) byId.set(story.id, story);
  }
  return inReadingOrder(feed, [...byId.values()]);
}

/**
 * The news a sport's tab shows, a quarter of an hour behind ESPN at most.
 * Nothing, rather than a failure, when ESPN does not answer: the tab goes.
 */
export const getEspnNews = cachedFeed(
  "ESPN news",
  fetchNews,
  (): NewsStory[] => [],
  ["espn:news"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:news"] }
);

/** The mappers, exported for their tests — nothing here touches the network. */
export const __testing = { newsUrl, storyFrom, inReadingOrder };
