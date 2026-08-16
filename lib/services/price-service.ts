import "server-only";

import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { priceAssets, priceQuotes } from "@/db/schema";

/**
 * CoinGecko's keyless Demo tier: no API key, ~10k calls/month at 100/min.
 *
 * That budget is why the cron runs HOURLY and not per-minute: one hourly call
 * is ~720/month and fits comfortably, while per-minute would be ~43k and blow
 * through the free tier four times over. The endpoint takes every id in one
 * request, so adding assets costs no extra calls.
 */
const BASE_URL = "https://api.coingecko.com/api/v3";
const TIMEOUT_MS = 15_000;

export type PriceFetchResult = {
  fetched: number;
  skipped: number;
  errors: string[];
};

/**
 * Pull the current price for every non-manual asset and append a quote row.
 *
 * Append-only on purpose: a bad fetch leaves a traceable row instead of
 * overwriting the last good price. Assets marked `manual` are never touched
 * here — they exist for anything the provider doesn't cover (indices, private
 * positions), which a human prices by hand.
 */
export async function refreshPrices(): Promise<PriceFetchResult> {
  const assets = await db
    .select()
    .from(priceAssets)
    .where(eq(priceAssets.source, "coingecko"));

  const priceable = assets.filter((a) => a.externalId);
  const skipped = assets.length - priceable.length;

  if (priceable.length === 0) {
    return { fetched: 0, skipped, errors: [] };
  }

  const ids = priceable.map((a) => a.externalId!).join(",");
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;

  let payload: Record<string, { usd?: number }>;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        fetched: 0,
        skipped,
        errors: [`coingecko ${res.status}`],
      };
    }
    payload = (await res.json()) as Record<string, { usd?: number }>;
  } catch (e) {
    // A provider outage must not take the cron down — the last known price
    // stays valid and the next run retries.
    return {
      fetched: 0,
      skipped,
      errors: [e instanceof Error ? e.message : "fetch failed"],
    };
  }

  const rows: { assetId: string; price: string }[] = [];
  const errors: string[] = [];

  for (const asset of priceable) {
    const usd = payload[asset.externalId!]?.usd;
    // A missing or non-positive price is a bad response, not a real quote:
    // writing 0 would silently value the position at nothing.
    if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) {
      errors.push(`no price for ${asset.symbol}`);
      continue;
    }
    rows.push({ assetId: asset.id, price: usd.toFixed(8) });
  }

  if (rows.length > 0) {
    await db.insert(priceQuotes).values(rows);
  }

  return { fetched: rows.length, skipped, errors };
}

/** Latest quote per asset, as a symbol-keyed map. */
export async function getLatestPrices(
  assetIds: string[]
): Promise<Map<string, number>> {
  if (assetIds.length === 0) return new Map();

  const quotes = await db
    .select()
    .from(priceQuotes)
    .where(inArray(priceQuotes.assetId, assetIds))
    .orderBy(desc(priceQuotes.fetchedAt));

  const latest = new Map<string, number>();
  for (const q of quotes) {
    // Ordered newest-first, so the first row per asset wins.
    if (!latest.has(q.assetId)) latest.set(q.assetId, parseFloat(q.price));
  }
  return latest;
}
