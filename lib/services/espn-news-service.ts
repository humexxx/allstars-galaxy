import "server-only";

import type { FootballLeagueId, NewsStory } from "@/types/sports";

import { cachedFeed, upstreamSignal } from "./upstream";

/** ESPN's site API, the one espn.com reads: no key. */
const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const REVALIDATE_SECONDS = 900;
/** A day's worth on a busy one: an NBA night is a recap a game. */
const LIMIT = 24;

/** Every wire a News tab reads, by the hub's own names. */
export type NewsFeed = "nba" | "nfl" | "atp" | FootballLeagueId;

const PATHS: Record<NewsFeed, string> = {
  nba: "basketball/nba",
  nfl: "football/nfl",
  atp: "tennis/atp",
  "premier-league": "soccer/eng.1",
  "la-liga": "soccer/esp.1",
  "serie-a": "soccer/ita.1",
  "uefa-champions-league": "soccer/uefa.champions",
  "world-cup": "soccer/fifa.world",
};

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

/** A league's or a tour's latest news, newest first. */
async function fetchNews(feed: NewsFeed): Promise<NewsStory[]> {
  const res = await fetch(`${BASE_URL}/${PATHS[feed]}/news?limit=${LIMIT}`, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`espn news ${res.status} for ${feed}`);
  const json = (await res.json()) as { articles?: EspnArticle[] };
  const byId = new Map<string, NewsStory>();
  for (const article of json.articles ?? []) {
    const story = storyFrom(article);
    if (story && !byId.has(story.id)) byId.set(story.id, story);
  }
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at));
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
export const __testing = { storyFrom };
