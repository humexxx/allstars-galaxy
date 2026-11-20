import "server-only";

import { unstable_cache } from "next/cache";

import { upstreamSignal } from "./upstream";

/**
 * Thin wrapper around microlink.io's free screenshot API. We use it so
 * the More Apps page can render real previews of sibling projects
 * without us having to integrate provider-specific screenshot endpoints
 * (Vercel's, Firebase doesn't have one, etc.).
 *
 * Free tier limit: 50 requests/day, anonymous. The whole lookup is cached
 * for 24h, a miss included: Next's fetch cache stores only 200s, so once the
 * quota ran out every visit asked microlink again for every app, and kept the
 * quota spent.
 *
 * Null on any failure so the caller can fall back to a gradient placeholder.
 */
const REVALIDATE_SECONDS = 86_400;
/** Lookups in flight at once: a page of apps must not land as one burst. */
const MAX_CONCURRENT = 3;

async function lookupScreenshot(targetUrl: string): Promise<string | null> {
  try {
    const apiUrl = new URL("https://api.microlink.io/");
    apiUrl.searchParams.set("url", targetUrl);
    apiUrl.searchParams.set("screenshot", "true");
    apiUrl.searchParams.set("meta", "false");

    const res = await fetch(apiUrl.toString(), {
      signal: upstreamSignal(),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: { screenshot?: { url?: string } };
    } | null;
    const url = json?.data?.screenshot?.url;
    return typeof url === "string" ? url : null;
  } catch (error) {
    // Best-effort: the card renders its placeholder art instead.
    console.error("[screenshot-service] Error fetching preview:", error);
    return null;
  }
}

export const getScreenshotUrl: (targetUrl: string) => Promise<string | null> = unstable_cache(
  lookupScreenshot,
  ["microlink-screenshot"],
  { revalidate: REVALIDATE_SECONDS }
);

/** One screenshot per url (null for none), in order, a few at a time. */
export async function getScreenshotUrls(urls: (string | null)[]): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(urls.length).fill(null);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < urls.length) {
      const i = next++;
      const url = urls[i];
      if (url) out[i] = await getScreenshotUrl(url);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, urls.length) }, worker));
  return out;
}
