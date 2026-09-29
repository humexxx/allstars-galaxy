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

  const priceable = assets.filter(
    (a): a is typeof a & { externalId: string } => !!a.externalId
  );
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
    list.push({ id: a.id, symbol: a.symbol, externalId: a.externalId });
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

/**
 * Newest quote row per asset. `DISTINCT ON` with the matching
 * `(asset_id, fetched_at desc)` index reads one row per asset; the history is
 * append-only and grows every day, so pulling it all and keeping the first row
 * in JS was a query that got slower for as long as the app ran.
 */
async function latestQuoteRows(
  assetIds: string[]
): Promise<Array<{ assetId: string; price: string; fetchedAt: Date }>> {
  if (assetIds.length === 0) return [];
  return db
    .selectDistinctOn([priceQuotes.assetId], {
      assetId: priceQuotes.assetId,
      price: priceQuotes.price,
      fetchedAt: priceQuotes.fetchedAt,
    })
    .from(priceQuotes)
    .where(inArray(priceQuotes.assetId, assetIds))
    .orderBy(priceQuotes.assetId, desc(priceQuotes.fetchedAt));
}

/** Epoch millis of the most recent quote per asset; absent when never quoted. */
async function latestQuoteTimes(assetIds: string[]): Promise<Map<string, number>> {
  const rows = await latestQuoteRows(assetIds);
  return new Map(rows.map((r) => [r.assetId, r.fetchedAt.getTime()]));
}

/** Latest quote per asset, keyed by asset id. */
export async function getLatestPrices(assetIds: string[]): Promise<Map<string, number>> {
  const rows = await latestQuoteRows(assetIds);
  return new Map(rows.map((r) => [r.assetId, parseFloat(r.price)]));
}

export type PriceAsset = typeof priceAssets.$inferSelect;

/** Every asset that can back a holding, ordered by ticker. */
export async function listPriceAssets(): Promise<PriceAsset[]> {
  return db.select().from(priceAssets).orderBy(priceAssets.symbol);
}

export async function getPriceAsset(assetId: string): Promise<PriceAsset | null> {
  const [row] = await db.select().from(priceAssets).where(eq(priceAssets.id, assetId)).limit(1);
  return row ?? null;
}

export async function getPriceAssetBySymbol(symbol: string): Promise<PriceAsset | null> {
  const [row] = await db
    .select()
    .from(priceAssets)
    .where(eq(priceAssets.symbol, symbol))
    .limit(1);
  return row ?? null;
}

/** Add an asset to the shared catalogue. */
export async function createPriceAsset(data: {
  symbol: string;
  name: string;
  source: PriceAsset["source"];
  externalId: string | null;
}): Promise<{ id: string }> {
  const [created] = await db
    .insert(priceAssets)
    .values(data)
    .returning({ id: priceAssets.id });
  return created;
}

/**
 * Price an asset by hand. An ordinary quote row, so a manual price and a
 * fetched one are the same kind of fact and the margin reads them identically.
 */
export async function insertManualQuote(assetId: string, price: number): Promise<void> {
  await db.insert(priceQuotes).values({ assetId, price: price.toFixed(8) });
}

/** Month-end price per asset, keyed `assetId|YYYY-MM`. */
export async function getMonthlyPrices(
  assetIds: string[]
): Promise<Map<string, number>> {
  if (assetIds.length === 0) return new Map();

  const quotes = await db
    .select()
    .from(priceQuotes)
    .where(inArray(priceQuotes.assetId, assetIds))
    .orderBy(priceQuotes.fetchedAt);

  const out = new Map<string, number>();
  // Ascending, so the last quote in a month overwrites earlier ones and the
  // month ends up carrying its closing price.
  for (const q of quotes) {
    out.set(`${q.assetId}|${q.fetchedAt.toISOString().slice(0, 7)}`, parseFloat(q.price));
  }
  return out;
}
