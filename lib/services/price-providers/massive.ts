import "server-only";

import { isUsablePrice, type PriceableAsset, type ProviderResult } from "./types";

/**
 * Massive — the market data API formerly known as Polygon.io (rebranded early
 * 2026). Unlike CoinGecko it covers crypto, indices, stocks, ETFs and forex
 * from one key, which is why the pooled capital can be deployed anywhere and
 * still be priced automatically.
 *
 * The rebrand kept the API identical and both hosts are live and
 * interchangeable — api.massive.com and the old api.polygon.io answer the same
 * routes with the same keys. We point at the current brand and leave the host
 * overridable, because "both work" is exactly the state that ends with one of
 * them being retired.
 *
 * Free tier: one "Basic" plan per asset class, end-of-day / 15-min delayed
 * data, 5 requests per minute. End-of-day is a perfect fit for a daily cron —
 * we want yesterday's close, not a live tick. The 5/min ceiling is the real
 * constraint and it shapes everything below.
 */
const DEFAULT_BASE_URL = "https://api.massive.com";
const TIMEOUT_MS = 15_000;

/**
 * Requests per run. The free tier allows 5 per minute and a cron invocation
 * has to finish inside the function timeout, so we spend the budget rather
 * than sleeping through several minutes: one call sweeps ALL crypto, leaving
 * four for individually-quoted tickers.
 */
const MAX_TICKER_CALLS = 4;

/** Massive prefixes crypto tickers `X:` and index tickers `I:`. */
function isCrypto(ticker: string): boolean {
  return ticker.startsWith("X:");
}

type AggResult = { T?: string; c?: number };
type AggResponse = { results?: AggResult[]; status?: string };

function baseUrl(): string {
  return process.env.MASSIVE_API_BASE_URL || DEFAULT_BASE_URL;
}

async function get(path: string, apiKey: string): Promise<AggResponse | null> {
  // The key goes in the header, never the query string: query params leak
  // into logs, proxies and error reports. Massive accepts `?apiKey=` too —
  // don't.
  const res = await fetch(`${baseUrl()}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`massive ${res.status} on ${path}`);
  }
  return (await res.json()) as AggResponse;
}

/** Yesterday, UTC, as YYYY-MM-DD. */
function previousUtcDay(now: Date): string {
  const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Every crypto price in a single request.
 *
 * Crypto trades 24/7, so "yesterday UTC" always has a closed daily bar — no
 * weekend or holiday hole to reason about. This is what keeps the run inside
 * the rate limit no matter how many coins the methods hold.
 */
async function fetchCryptoGrouped(
  assets: PriceableAsset[],
  apiKey: string,
  now: Date
): Promise<{ prices: Map<string, number>; error: string | null }> {
  const prices = new Map<string, number>();
  try {
    const body = await get(
      `/v2/aggs/grouped/locale/global/market/crypto/${previousUtcDay(now)}`,
      apiKey
    );
    const closes = new Map<string, number>();
    for (const r of body?.results ?? []) {
      if (r.T && isUsablePrice(r.c)) closes.set(r.T, r.c);
    }
    if (closes.size === 0) {
      return { prices, error: "massive grouped crypto returned no bars" };
    }
    for (const a of assets) {
      const close = closes.get(a.externalId);
      if (close !== undefined) prices.set(a.id, close);
    }
    return { prices, error: null };
  } catch (e) {
    return { prices, error: e instanceof Error ? e.message : "grouped fetch failed" };
  }
}

/**
 * One ticker, one request — the previous closed bar.
 *
 * `/prev` is used rather than a dated endpoint because it resolves the last
 * *trading* day itself. Indices and stocks don't trade at weekends, and asking
 * for a fixed date would quietly return nothing every Saturday.
 */
async function fetchOne(
  asset: PriceableAsset,
  apiKey: string
): Promise<{ price: number | null; error: string | null }> {
  try {
    const body = await get(
      `/v2/aggs/ticker/${encodeURIComponent(asset.externalId)}/prev`,
      apiKey
    );
    const close = body?.results?.[0]?.c;
    if (!isUsablePrice(close)) {
      return { price: null, error: `no close for ${asset.symbol}` };
    }
    return { price: close, error: null };
  } catch (e) {
    return {
      price: null,
      error: e instanceof Error ? e.message : `fetch failed for ${asset.symbol}`,
    };
  }
}

export type HistoricalBar = { day: string; close: number };

/**
 * Daily closes for one ticker across a date range, in a single request.
 *
 * Used to price a contribution at the day it landed. One call covers the whole
 * range however many dates are needed, which keeps a backfill of many
 * contributions inside the 5 req/min free tier.
 *
 * Returns bars ascending. Days the asset did not trade are simply absent —
 * callers must fall back to the most recent earlier bar rather than assuming a
 * bar exists for every calendar date (see `closeOnOrBefore`).
 */
export async function fetchDailyCloses(
  ticker: string,
  from: string,
  to: string
): Promise<{ bars: HistoricalBar[]; error: string | null }> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) return { bars: [], error: "MASSIVE_API_KEY is not set" };

  try {
    const body = await get(
      `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}` +
        `?adjusted=true&sort=asc&limit=50000`,
      apiKey
    );
    const bars: HistoricalBar[] = [];
    for (const r of (body as { results?: { t?: number; c?: number }[] }).results ?? []) {
      if (typeof r.t === "number" && isUsablePrice(r.c)) {
        bars.push({ day: new Date(r.t).toISOString().slice(0, 10), close: r.c });
      }
    }
    return { bars, error: bars.length === 0 ? `no bars for ${ticker}` : null };
  } catch (e) {
    return { bars: [], error: e instanceof Error ? e.message : "history fetch failed" };
  }
}

/**
 * The close on `day`, or the most recent one before it.
 *
 * Contributions land on calendar dates; stocks and ETFs do not trade at
 * weekends. Taking the last known close is what a real purchase would have
 * been priced at, and it is why `pricedOn` is stored separately from the
 * contribution date.
 */
export function closeOnOrBefore(
  bars: HistoricalBar[],
  day: string
): HistoricalBar | null {
  let best: HistoricalBar | null = null;
  for (const bar of bars) {
    if (bar.day <= day && (!best || bar.day > best.day)) best = bar;
  }
  return best;
}

/**
 * Quote every asset Massive is responsible for.
 *
 * `assets` must arrive stalest-first: when there are more individually-quoted
 * tickers than the per-run budget allows, the ones left over are the ones with
 * the freshest price, and they get picked up on the next run. Nothing is
 * dropped silently — the overflow is reported in `skipped`.
 */
export async function fetchMassivePrices(
  assets: PriceableAsset[],
  now: Date = new Date()
): Promise<ProviderResult> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return {
      prices: new Map(),
      skipped: assets.length,
      errors: assets.length > 0 ? ["MASSIVE_API_KEY is not set"] : [],
    };
  }

  const prices = new Map<string, number>();
  const errors: string[] = [];

  const crypto = assets.filter((a) => isCrypto(a.externalId));
  const rest = assets.filter((a) => !isCrypto(a.externalId));

  if (crypto.length > 0) {
    const grouped = await fetchCryptoGrouped(crypto, apiKey, now);
    for (const [id, price] of grouped.prices) prices.set(id, price);
    if (grouped.error) errors.push(grouped.error);

    // The grouped sweep is one call but it is also a single point of failure.
    // If it came back empty, fall back to quoting coins individually so a bad
    // day for that endpoint doesn't leave every holding unpriced.
    if (grouped.prices.size === 0) {
      rest.unshift(...crypto);
    } else {
      const missing = crypto.filter((a) => !prices.has(a.id));
      if (missing.length > 0) {
        errors.push(
          `not in grouped crypto bars: ${missing.map((a) => a.symbol).join(", ")}`
        );
      }
    }
  }

  const budget = crypto.length > 0 ? MAX_TICKER_CALLS : MAX_TICKER_CALLS + 1;
  const toQuote = rest.slice(0, budget);
  const overflow = rest.length - toQuote.length;

  for (const asset of toQuote) {
    const { price, error } = await fetchOne(asset, apiKey);
    if (price !== null) prices.set(asset.id, price);
    if (error) errors.push(error);
  }

  if (overflow > 0) {
    errors.push(
      `rate limit: ${overflow} asset(s) deferred to the next run (5 req/min free tier)`
    );
  }

  return { prices, skipped: overflow, errors };
}
