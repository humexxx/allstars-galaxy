import "server-only";

import type { NewsStory } from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

/**
 * League of Legends' news: Riot's own lolesports.com news page (its
 * robots.txt allows every reader). It has no JSON API, so the stories are
 * read out of the page's React payload, where each is an `Article` object.
 * Pro play only, about eight a month; it fails soft to no News tab.
 */
const NEWS_URL = "https://lolesports.com/en-US/news";
const SITE = "https://lolesports.com/en-US";
const USER_AGENT = "AllstarsGalaxy/1.0 (personal sports dashboard)";
const REVALIDATE_SECONDS = 3600;
const LIMIT = 24;

type LolArticle = {
  _id?: string;
  externalTitle?: string;
  description?: string | null;
  externalUrl?: string | null;
  path?: { current?: string } | null;
  publishingDates?: { displayedPublishDate?: string } | null;
  bannerMedia?: { sanityImage?: { asset?: { url?: string } | null } | null } | null;
};

/** The page's React payload: every `self.__next_f.push([1, "…"])` string, decoded and joined. */
function payloadOf(html: string): string {
  const chunks: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g)) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      // A chunk that is not a plain string holds no article.
    }
  }
  return chunks.join("");
}

/** The JSON object that starts at `start`, by its balanced braces (strings skipped). */
function objectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function articlesIn(html: string): LolArticle[] {
  const payload = payloadOf(html);
  const marker = '{"__typename":"Article"';
  const byId = new Map<string, LolArticle>();
  for (let at = payload.indexOf(marker); at !== -1; at = payload.indexOf(marker, at + 1)) {
    const json = objectAt(payload, at);
    if (!json) continue;
    try {
      const article = JSON.parse(json) as LolArticle;
      if (article._id && !byId.has(article._id)) byId.set(article._id, article);
    } catch {
      // A fragment the payload referenced rather than inlined.
    }
  }
  return [...byId.values()];
}

function storyFrom(article: LolArticle): NewsStory | null {
  const at = article.publishingDates?.displayedPublishDate;
  const path = article.path?.current;
  const href = article.externalUrl || (path ? `${SITE}${path}` : null);
  if (!article._id || !article.externalTitle || !at || !href) return null;
  const image = article.bannerMedia?.sanityImage?.asset?.url;
  return {
    id: `lolesports-${article._id}`,
    headline: article.externalTitle.trim(),
    description: article.description?.trim() || null,
    href,
    external: true,
    // Sanity resizes on request: a 768px copy instead of the 1920px original.
    image: image ? { url: `${image}?w=768&auto=format` } : null,
    at,
    kind: /youtube\.com|youtu\.be/.test(href) ? "video" : "story",
    about: [],
  };
}

async function fetchNews(): Promise<NewsStory[]> {
  const res = await fetch(NEWS_URL, { signal: upstreamSignal(), headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`lolesports news ${res.status}`);
  const stories = articlesIn(await res.text())
    .map(storyFrom)
    .filter((s): s is NewsStory => s !== null);
  return stories.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}

/** League of Legends' News tab, an hour behind lolesports.com at most. */
export const getLolNews = cachedFeed("lolesports news", fetchNews, (): NewsStory[] => [], ["lolesports:news"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["sports:news"],
});

/** Pure parsers, exported for their tests. */
export const __testing = { articlesIn, storyFrom };
