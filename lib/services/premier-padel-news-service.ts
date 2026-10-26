import "server-only";

import type { NewsStory } from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

/**
 * Premier Padel's own news, the backend premierpadel.com's news page reads:
 * no key, about a story a day, every one with a picture. Undocumented, so it
 * fails soft: no answer is no News tab. Padel API's news endpoint carried one
 * story across four events, and ESPN has no padel.
 */
const NEWS_URL = "https://api-prod.premierpadel.com/api/news/getNews";
const SITE = "https://premierpadel.com/en/news";
const CDN = "https://cdn.premierpadel.com";
const LIMIT = 24;
const REVALIDATE_SECONDS = 900;

type PremierPadelStory = {
  id?: number;
  slug?: string;
  published_at?: string;
  title?: string;
  hero_media_type?: string;
  /** The compressed copy: the original runs to megabytes. */
  hero_media_thumbnail?: string;
};

function storyFrom(item: PremierPadelStory): NewsStory | null {
  if (!item.id || !item.slug || !item.title || !item.published_at) return null;
  return {
    id: `premierpadel-${item.id}`,
    headline: item.title.trim(),
    description: null,
    href: `${SITE}/${encodeURIComponent(item.slug)}`,
    external: true,
    image: item.hero_media_thumbnail ? { url: `${CDN}${item.hero_media_thumbnail}` } : null,
    at: item.published_at,
    kind: item.hero_media_type && item.hero_media_type !== "image" ? "video" : "story",
    about: [],
  };
}

async function fetchNews(): Promise<NewsStory[]> {
  const res = await fetch(`${NEWS_URL}?limit=${LIMIT}&page=1&type=latest`, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`premier padel news ${res.status}`);
  const json = (await res.json()) as { data?: PremierPadelStory[] };
  const stories = (json.data ?? []).map(storyFrom).filter((s): s is NewsStory => s !== null);
  return stories.sort((a, b) => b.at.localeCompare(a.at));
}

/** Padel's News tab, a quarter of an hour behind Premier Padel at most. */
export const getPadelNews = cachedFeed("Premier Padel news", fetchNews, (): NewsStory[] => [], ["premierpadel:news"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["sports:news"],
});

/** Pure mapper, exported for its test. */
export const __testing = { storyFrom };
