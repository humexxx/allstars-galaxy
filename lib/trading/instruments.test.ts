import { describe, expect, it } from "vitest";

import { instrumentSymbol, marketLabel, rankInstruments, typedSymbol } from "./instruments";

const ticker = (t: string, name: string, market: string) => ({ ticker: t, name, market });

describe("instrumentSymbol", () => {
  it("drops the provider's market prefix", () => {
    expect(instrumentSymbol("C:XAUUSD")).toBe("XAUUSD");
    expect(instrumentSymbol("X:btcusd")).toBe("BTCUSD");
    expect(instrumentSymbol("I:SPX")).toBe("SPX");
    expect(instrumentSymbol("AAPL")).toBe("AAPL");
  });
});

describe("typedSymbol", () => {
  it("reads what was typed as a symbol would spell it", () => {
    expect(typedSymbol("xau/usd")).toBe("XAUUSD");
    expect(typedSymbol(" brk.b ")).toBe("BRK.B");
    expect(typedSymbol("—")).toBe("");
  });
});

describe("rankInstruments", () => {
  // In the provider's own order: by ticker.
  const found = [
    ticker("C:XAUAUD", "Gold - Australian dollar", "fx"),
    ticker("C:XAUUSD", "Gold - United States dollar", "fx"),
    ticker("X:XAUTUSD", "Tether Gold - United States dollar", "crypto"),
    ticker("XAUG", "Xau Growth Fund", "stocks"),
  ];

  it("puts the pair against the dollar first, not the provider's first row", () => {
    expect(rankInstruments("xau", found, 3).map((i) => i.symbol)).toEqual(["XAUUSD", "XAUG", "XAUTUSD"]);
  });

  it("puts the symbol itself above everything", () => {
    const rows = [ticker("AAPB", "2x Long Apple", "stocks"), ticker("AAPL", "Apple Inc.", "stocks")];
    expect(rankInstruments("aapl", rows, 5)[0]).toEqual({ symbol: "AAPL", name: "Apple Inc.", market: "stocks", ticker: "AAPL" });
  });

  it("finds by name what the ticker does not spell", () => {
    const rows = [ticker("APLE", "Apple Hospitality REIT", "stocks"), ticker("MLP", "Maui Land & Pineapple", "stocks")];
    expect(rankInstruments("apple", rows, 5).map((i) => i.symbol)).toEqual(["APLE", "MLP"]);
  });

  it("lists a symbol once, the likelier market first", () => {
    const rows = [ticker("X:SOLUSD", "Solana - United States dollar", "crypto"), ticker("C:SOLUSD", "Sol", "fx")];
    expect(rankInstruments("sol", rows, 5)).toEqual([expect.objectContaining({ ticker: "X:SOLUSD" })]);
  });

  it("leaves out a ticker too long for a trade to hold", () => {
    expect(rankInstruments("o:", [ticker("O:SPY251219C00650000XXXXXXX", "SPY option", "options")], 5)).toEqual([]);
  });
});

describe("marketLabel", () => {
  it("names the markets the form knows", () => {
    expect(marketLabel("fx")).toBe("Forex");
    expect(marketLabel("options")).toBeNull();
    expect(marketLabel(null)).toBeNull();
  });
});
