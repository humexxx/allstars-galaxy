import "server-only";

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
