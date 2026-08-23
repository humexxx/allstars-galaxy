/** The slice of a price asset a provider needs to quote it. */
export type PriceableAsset = {
  id: string;
  symbol: string;
  /** The provider's own identifier — a CoinGecko coin id, a Massive ticker. */
  externalId: string;
};

export type ProviderResult = {
  /** assetId -> price in USD. Only successful quotes appear here. */
  prices: Map<string, number>;
  /** Assets the provider was asked for but did not reach this run. */
  skipped: number;
  errors: string[];
};

/**
 * A price is only real if it is a finite positive number. Zero is the
 * dangerous case: it parses fine and would silently value a holding at
 * nothing, so it is rejected like any other bad response.
 */
export function isUsablePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
