import "server-only";

import { upstreamSignal } from "../upstream";
import { isUsablePrice, type PriceableAsset, type ProviderResult } from "./types";

/**
 * CoinGecko's keyless Demo tier: no API key at all, ~10k calls/month.
 *
 * Kept alongside Massive rather than replaced. It needs no signup, quotes the
 * long tail of coins Massive doesn't list, and takes every id in one request —
 * so it costs a single call however many assets point at it.
 */
const BASE_URL = "https://api.coingecko.com/api/v3";

export async function fetchCoinGeckoPrices(
  assets: PriceableAsset[]
): Promise<ProviderResult> {
  if (assets.length === 0) {
    return { prices: new Map(), skipped: 0, errors: [] };
  }

  const ids = assets.map((a) => a.externalId).join(",");
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;

  let payload: unknown;
  try {
    const res = await fetch(url, {
      signal: upstreamSignal(),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { prices: new Map(), skipped: assets.length, errors: [`coingecko ${res.status}`] };
    }
    payload = await res.json();
  } catch (e) {
    // A provider outage must not take the cron down — the last known price
    // stays valid and the next run retries.
    return {
      prices: new Map(),
      skipped: assets.length,
      errors: [e instanceof Error ? e.message : "fetch failed"],
    };
  }

  // A 200 can still carry `null` or an error object; reading through it threw
  // past the caller and took the other provider's quotes with it.
  if (!isRecord(payload)) {
    return { prices: new Map(), skipped: assets.length, errors: ["coingecko returned no prices"] };
  }

  const prices = new Map<string, number>();
  const errors: string[] = [];

  for (const asset of assets) {
    const entry = payload[asset.externalId];
    const usd = isRecord(entry) ? entry.usd : undefined;
    if (!isUsablePrice(usd)) {
      errors.push(`no price for ${asset.symbol}`);
      continue;
    }
    prices.set(asset.id, usd);
  }

  return { prices, skipped: 0, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
