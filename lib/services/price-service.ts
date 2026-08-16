import "server-only";

import { desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { priceAssets, priceQuotes } from "@/db/schema";
import { fetchCoinGeckoPrices } from "./price-providers/coingecko";
import { fetchMassivePrices } from "./price-providers/massive";
import type { PriceableAsset } from "./price-providers/types";

export type PriceFetchResult = {
  fetched: number;
  skipped: number;
  errors: string[];
};

/**
 * `manual` is not a provider — it is the escape hatch for anything no API
 * quotes (a private position, an illiquid instrument). A human prices those by
 * hand and the cron must never overwrite them.
 */
const MANUAL = "manual";

/**
 * Pull the current price for every automatically-priced asset and append a
 * quote row.
 *
 * Append-only on purpose: a bad fetch leaves a traceable row instead of
 * overwriting the last good price, and the margin can be replayed for any past
 * date because no history is ever destroyed.
 */
export async function refreshPrices(): Promise<PriceFetchResult> {
  const assets = await db.select().from(priceAssets).where(ne(priceAssets.source, MANUAL));

  const priceable = assets.filter((a) => a.externalId);
  let skipped = assets.length - priceable.length;

  if (priceable.length === 0) {
    return { fetched: 0, skipped, errors: [] };
  }

  // Stalest first. It only changes the outcome when a provider has to defer
  // work under a rate limit, but then it is what stops the same assets being
  // starved every single run.
  const lastSeen = await latestQuoteTimes(priceable.map((a) => a.id));
  const ordered = [...priceable].sort(
    (a, b) => (lastSeen.get(a.id) ?? 0) - (lastSeen.get(b.id) ?? 0)
  );

  const bySource = new Map<string, PriceableAsset[]>();
  for (const a of ordered) {
    const list = bySource.get(a.source) ?? [];
    list.push({ id: a.id, symbol: a.symbol, externalId: a.externalId! });
    bySource.set(a.source, list);
  }

  const errors: string[] = [];
  const prices = new Map<string, number>();

  for (const [source, list] of bySource) {
    const result =
      source === "massive"
        ? await fetchMassivePrices(list)
        : source === "coingecko"
          ? await fetchCoinGeckoPrices(list)
          : { prices: new Map<string, number>(), skipped: list.length, errors: [`unknown source "${source}"`] };

    for (const [id, price] of result.prices) prices.set(id, price);
    skipped += result.skipped;
    errors.push(...result.errors);
  }

  const rows = [...prices].map(([assetId, price]) => ({
    assetId,
    price: price.toFixed(8),
  }));

  if (rows.length > 0) {
    await db.insert(priceQuotes).values(rows);
  }

  return { fetched: rows.length, skipped, errors };
}

/** Epoch millis of the most recent quote per asset; absent when never quoted. */
async function latestQuoteTimes(assetIds: string[]): Promise<Map<string, number>> {
  const rows = await db
    .select({ assetId: priceQuotes.assetId, fetchedAt: priceQuotes.fetchedAt })
    .from(priceQuotes)
    .where(inArray(priceQuotes.assetId, assetIds))
    .orderBy(desc(priceQuotes.fetchedAt));

  const latest = new Map<string, number>();
  for (const r of rows) {
    if (!latest.has(r.assetId)) latest.set(r.assetId, r.fetchedAt.getTime());
  }
  return latest;
}

/** Latest quote per asset, keyed by asset id. */
export async function getLatestPrices(assetIds: string[]): Promise<Map<string, number>> {
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

/** Every asset that can back a holding, newest listing last. */
export async function listPriceAssets() {
  return db.select().from(priceAssets).orderBy(priceAssets.symbol);
}

export async function getPriceAssetBySymbol(symbol: string) {
  const [row] = await db
    .select()
    .from(priceAssets)
    .where(eq(priceAssets.symbol, symbol))
    .limit(1);
  return row ?? null;
}
