import "server-only";

import { htmlText } from "@/lib/utils/html";
import type { NewsStory } from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

/**
 * Surfing's news: Stab Magazine's WSL tag, through its WordPress API (its
 * robots.txt allows every reader). ESPN carries no surfing, and Stab covers
 * the Championship Tour a few times a week, a picture with every story.
 */
const POSTS_URL = "https://stabmag.com/wp-json/wp/v2/posts";
/** Stab's "WSL" tag. */
const WSL_TAG = 26;
const LIMIT = 24;
const REVALIDATE_SECONDS = 3600;

type WpMedia = {
  source_url?: string;
  alt_text?: string;
  media_details?: { sizes?: Record<string, { source_url?: string } | undefined> };
};

type WpPost = {
  id?: number;
  date_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: { "wp:featuredmedia"?: WpMedia[] };
};

/** The 768px copy where there is one: the original is 2560px across. */
function pictureOf(media: WpMedia | undefined): NewsStory["image"] {
  const url = media?.media_details?.sizes?.medium_large?.source_url ?? media?.source_url;
  if (!url) return null;
  return { url, ...(media?.alt_text ? { alt: media.alt_text } : {}) };
}

/** A story, or null for one a reader could not open: Stab's premium posts sit behind a paywall. */
function storyFrom(post: WpPost): NewsStory | null {
  const headline = htmlText(post.title?.rendered ?? "");
  if (!post.id || !post.link || !headline || !post.date_gmt || post.link.includes("/premium/")) return null;
  return {
    id: `stab-${post.id}`,
    headline,
    description: htmlText(post.excerpt?.rendered ?? "") || null,
    href: post.link,
    external: true,
    image: pictureOf(post._embedded?.["wp:featuredmedia"]?.[0]),
    // WordPress's GMT date carries no zone of its own.
    at: `${post.date_gmt}Z`,
    kind: "story",
    about: [],
  };
}

async function fetchNews(): Promise<NewsStory[]> {
  const url = `${POSTS_URL}?tags=${WSL_TAG}&per_page=${LIMIT}&_embed=wp:featuredmedia`;
  const res = await fetch(url, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`stab news ${res.status}`);
  const posts = (await res.json()) as WpPost[];
  const stories = posts.map(storyFrom).filter((s): s is NewsStory => s !== null);
  return stories.sort((a, b) => b.at.localeCompare(a.at));
}

/** Surfing's News tab, an hour behind Stab at most. */
export const getSurfNews = cachedFeed("Stab surf news", fetchNews, (): NewsStory[] => [], ["stab:surf-news"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["sports:news"],
});

/** Pure mapper, exported for its test. */
export const __testing = { storyFrom };
