import "server-only";

import { unstable_cache } from "next/cache";

/**
 * Ceiling for one call to a third-party API.
 *
 * The `unstable_cache` wrappers around the sports and market feeds protect the
 * steady state, but on a cache miss a provider that never answers would hold
 * the render for the platform's whole function timeout. Every outbound fetch
 * carries this signal so a hung upstream degrades to the mock/empty fallback
 * the caller already has instead of a blank page. Well under the 10s
 * serverless budget, with room for the fallback to run.
 */
export const UPSTREAM_TIMEOUT_MS = 8_000;

export function upstreamSignal(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}

/**
 * A cached provider read that keeps its last good answer through a failed
 * refresh, and only falls back when there has never been one.
 *
 * `unstable_cache` serves a stale entry while it refreshes in the background,
 * and when that refresh throws it keeps the stale entry. Catching inside the
 * cached function threw that away: a single 429 returned the mock, and the
 * mock was then cached for the full revalidate window as if it were the data.
 * So `fetchLive` must throw on failure, and the fallback is applied out here,
 * where it is never stored.
 */
export function cachedFeed<Args extends unknown[], T>(
  label: string,
  fetchLive: (...args: Args) => Promise<T>,
  fallback: (...args: Args) => T,
  keyParts: string[],
  options: { revalidate: number; tags?: string[] }
): (...args: Args) => Promise<T> {
  const cached = unstable_cache(fetchLive, keyParts, options);
  return async (...args: Args): Promise<T> => {
    try {
      return await cached(...args);
    } catch (error) {
      console.warn(`${label} unavailable, using fallback:`, error);
      return fallback(...args);
    }
  };
}
