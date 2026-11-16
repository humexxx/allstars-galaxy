import "server-only";

import { unstable_cache } from "next/cache";

import { findMassiveTickers } from "@/lib/services/price-providers/massive";
import { listPriceAssets } from "@/lib/services/price-service";
import { UPSTREAM_TIMEOUT_MS } from "@/lib/services/upstream";
import { instrumentSymbol, rankInstruments, typedSymbol } from "@/lib/trading/instruments";
import type { TradingInstrument } from "@/types/trading";

/** How many market matches the form lists. */
const SHOWN = 8;
/** Kept past `SHOWN`, so dropping the ones already linked still leaves a full list. */
const KEPT = 16;
/** A day: which tickers exist barely moves, and each read spends the provider's quota. */
const REVALIDATE_SECONDS = 24 * 60 * 60;

type RankedInstrument = TradingInstrument & { ticker: string };

/**
 * The provider's best matches for a query. Throws when the provider cannot
 * answer — no key, a refusal, a timeout — so a failure is never cached.
 */
async function searchProvider(query: string): Promise<RankedInstrument[]> {
  const found = await findMassiveTickers({ search: query }, UPSTREAM_TIMEOUT_MS);
  if (!found) throw new Error("MASSIVE_API_KEY is not set");
  const typed = typedSymbol(query);
  let tickers = found.tickers;
  // A broad word ("MS", "US") matches more than one page, and the page is in
  // ticker order: the ticker that IS the word may be past its end.
  if (found.more && typed !== "" && !tickers.some((t) => instrumentSymbol(t.ticker) === typed)) {
    const exact = await findMassiveTickers({ ticker: typed }, UPSTREAM_TIMEOUT_MS).catch(() => null);
    tickers = [...(exact?.tickers ?? []), ...tickers];
  }
  return rankInstruments(query, tickers, KEPT);
}

const cachedSearch = unstable_cache(searchProvider, ["trading-instrument-search"], {
  revalidate: REVALIDATE_SECONDS,
});

/** The assets already linked for pricing, as instruments. */
export async function getLinkedInstruments(): Promise<TradingInstrument[]> {
  const assets = await listPriceAssets();
  return assets.map((a) => ({ symbol: a.symbol.toUpperCase(), name: a.name, market: null }));
}

/**
 * Market instruments matching a query, best first, without the ones already
 * linked (the form lists those itself, under the symbol they are linked by).
 * Null when the search is unavailable — the form then takes a typed symbol.
 */
export async function searchInstruments(query: string): Promise<TradingInstrument[] | null> {
  let ranked: RankedInstrument[];
  try {
    ranked = await cachedSearch(query.trim().toLowerCase());
  } catch (error) {
    console.warn("instrument search unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
  const assets = await listPriceAssets();
  const linkedTickers = new Set(assets.map((a) => a.externalId).filter(Boolean));
  const linkedSymbols = new Set(assets.map((a) => a.symbol.toUpperCase()));
  return ranked
    .filter((r) => !linkedTickers.has(r.ticker) && !linkedSymbols.has(r.symbol))
    .slice(0, SHOWN)
    .map(({ symbol, name, market }) => ({ symbol, name, market }));
}
