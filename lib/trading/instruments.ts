import type { TradingInstrument } from "@/types/trading";

/** A ticker as the market-data provider lists it. */
export type ProviderTicker = { ticker: string; name: string | null; market: string | null };

/** The longest symbol a trade holds. */
export const MAX_SYMBOL_LENGTH = 24;

/** Which market wins a tie; an unknown one goes last. */
const MARKET_ORDER = ["stocks", "crypto", "fx", "indices", "otc"];

/**
 * The symbol a trade is filed under for a provider ticker: without the
 * provider's market prefix — `C:XAUUSD` (forex), `X:BTCUSD` (crypto),
 * `I:SPX` (index) — and in capitals.
 */
export function instrumentSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^[A-Z]:/, "");
}

/** What somebody typed, as a symbol would spell it: "xau/usd" reads as XAUUSD. */
export function typedSymbol(query: string): string {
  return query.toUpperCase().replace(/[^A-Z0-9.]/g, "");
}

/**
 * How well a ticker answers what was typed, lower first: the symbol itself,
 * its pair against the dollar (XAU finds XAUUSD), a symbol starting with it,
 * a name starting with it, then anything else the provider matched.
 */
function relevance(symbol: string, name: string | null, typed: string, query: string): number {
  if (symbol === typed) return 0;
  if (symbol === `${typed}USD`) return 1;
  if (typed !== "" && symbol.startsWith(typed)) return 2;
  if (name?.toLowerCase().startsWith(query.trim().toLowerCase())) return 3;
  return 4;
}

function marketRank(market: string | null): number {
  const i = market == null ? -1 : MARKET_ORDER.indexOf(market);
  return i === -1 ? MARKET_ORDER.length : i;
}

/**
 * The provider's matches as the form offers them: best answer first, one per
 * symbol, at most `limit`. The provider orders by ticker, so its own first
 * rows are rarely the ones meant.
 */
export function rankInstruments(
  query: string,
  tickers: readonly ProviderTicker[],
  limit: number
): (TradingInstrument & { ticker: string })[] {
  const typed = typedSymbol(query);
  const ranked = tickers
    .map((t) => {
      const symbol = instrumentSymbol(t.ticker);
      return { ...t, symbol, score: relevance(symbol, t.name, typed, query) };
    })
    .filter((t) => t.symbol !== "" && t.symbol.length <= MAX_SYMBOL_LENGTH)
    .sort(
      (a, b) =>
        a.score - b.score ||
        marketRank(a.market) - marketRank(b.market) ||
        a.symbol.length - b.symbol.length ||
        a.symbol.localeCompare(b.symbol)
    );
  const seen = new Set<string>();
  const out: (TradingInstrument & { ticker: string })[] = [];
  for (const t of ranked) {
    if (seen.has(t.symbol)) continue;
    seen.add(t.symbol);
    out.push({ symbol: t.symbol, name: t.name, market: t.market, ticker: t.ticker });
    if (out.length === limit) break;
  }
  return out;
}

const MARKET_LABELS: Record<string, string> = {
  stocks: "Stock",
  crypto: "Crypto",
  fx: "Forex",
  indices: "Index",
  otc: "OTC",
};

/** A market as the form names it; null for one it has no name for. */
export function marketLabel(market: string | null): string | null {
  return market == null ? null : (MARKET_LABELS[market] ?? null);
}
