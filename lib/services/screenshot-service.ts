import "server-only";

import { unstable_cache } from "next/cache";

import { upstreamSignal } from "./upstream";

/**
 * Thin wrapper around microlink.io's free screenshot API. We use it so
 * the More Apps page can render real previews of sibling projects
 * without us having to integrate provider-specific screenshot endpoints
 * (Vercel's, Firebase doesn't have one, etc.).
 *
 * Free tier limit: 50 requests/day, anonymous. A screenshot is cached for
 * 24h. A failed lookup throws inside the cache, so a refresh that fails keeps
 * the last good screenshot instead of storing null over it; the caller then
 * gets null and this instance waits an hour before asking microlink about
 * that url again, so a spent quota is not asked again on every visit.
 *
 * Null on any failure so the caller can fall back to a gradient placeholder.
 */
const REVALIDATE_SECONDS = 86_400;
/** After a failed lookup, how long this instance leaves the url alone. */
const RETRY_AFTER_MS = 3_600_000;
/** Lookups in flight at once: a page of apps must not land as one burst. */
const MAX_CONCURRENT = 3;

const failedAt = new Map<string, number>();

async function lookupScreenshot(targetUrl: string): Promise<string | null> {
  const apiUrl = new URL("https://api.microlink.io/");
  apiUrl.searchParams.set("url", targetUrl);
  apiUrl.searchParams.set("screenshot", "true");
  apiUrl.searchParams.set("meta", "false");

  const res = await fetch(apiUrl.toString(), {
    signal: upstreamSignal(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`microlink ${res.status}`);

  const json = (await res.json()) as {
    data?: { screenshot?: { url?: string } };
  } | null;
  const url = json?.data?.screenshot?.url;
  // A page microlink read but could not shoot is an answer, not a failure.
  return typeof url === "string" ? url : null;
}

const cachedLookup = unstable_cache(lookupScreenshot, ["microlink-screenshot"], {
  revalidate: REVALIDATE_SECONDS,
});

export async function getScreenshotUrl(targetUrl: string, now: number = Date.now()): Promise<string | null> {
  const failed = failedAt.get(targetUrl);
  if (failed !== undefined && now - failed < RETRY_AFTER_MS) return null;
  try {
    const url = await cachedLookup(targetUrl);
    failedAt.delete(targetUrl);
    return url;
  } catch (error) {
    // Best-effort: the card renders its placeholder art instead.
    console.error("[screenshot-service] Error fetching preview:", error);
    failedAt.set(targetUrl, now);
    return null;
  }
}

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
