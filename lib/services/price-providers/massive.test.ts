import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMassivePrices } from "./massive";

const NOW = new Date("2026-08-15T00:30:00.000Z");

const ADA = { id: "a-ada", symbol: "ADA", externalId: "X:ADAUSD" };
const BTC = { id: "a-btc", symbol: "BTC", externalId: "X:BTCUSD" };
const SPX = { id: "a-spx", symbol: "SPX", externalId: "I:SPX" };

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function grouped(bars: { T: string; c: number }[]) {
  return ok({ status: "OK", results: bars });
}

function prev(ticker: string, close: number) {
  return ok({ status: "OK", ticker, results: [{ T: ticker, c: close }] });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.MASSIVE_API_KEY = "test-key";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MASSIVE_API_KEY;
  delete process.env.MASSIVE_API_BASE_URL;
});

describe("fetchMassivePrices", () => {
  it("quotes every crypto asset from a single grouped request", async () => {
    fetchMock.mockResolvedValueOnce(
      grouped([
        { T: "X:ADAUSD", c: 0.18 },
        { T: "X:BTCUSD", c: 63014.5 },
        { T: "X:DOGEUSD", c: 0.09 },
      ])
    );

    const result = await fetchMassivePrices([ADA, BTC], NOW);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.prices.get("a-ada")).toBe(0.18);
    expect(result.prices.get("a-btc")).toBe(63014.5);
    expect(result.errors).toEqual([]);
  });

  it("asks for yesterday's bars, not today's", async () => {
    fetchMock.mockResolvedValueOnce(grouped([{ T: "X:ADAUSD", c: 0.18 }]));

    await fetchMassivePrices([ADA], NOW);

    expect(fetchMock.mock.calls[0][0]).toContain("/crypto/2026-08-14");
  });

  it("sends the key as a bearer header and never in the query string", async () => {
    fetchMock.mockResolvedValueOnce(grouped([{ T: "X:ADAUSD", c: 0.18 }]));

    await fetchMassivePrices([ADA], NOW);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("test-key");
    expect(init.headers.authorization).toBe("Bearer test-key");
  });

  it("quotes non-crypto tickers one at a time via /prev", async () => {
    fetchMock.mockResolvedValueOnce(prev("I:SPX", 5432.1));

    const result = await fetchMassivePrices([SPX], NOW);

    expect(fetchMock.mock.calls[0][0]).toContain("/v2/aggs/ticker/I%3ASPX/prev");
    expect(result.prices.get("a-spx")).toBe(5432.1);
  });

  it("falls back to per-ticker quotes when the grouped sweep comes back empty", async () => {
    fetchMock
      .mockResolvedValueOnce(grouped([]))
      .mockResolvedValueOnce(prev("X:ADAUSD", 0.18))
      .mockResolvedValueOnce(prev("X:BTCUSD", 63014.5));

    const result = await fetchMassivePrices([ADA, BTC], NOW);

    expect(result.prices.get("a-ada")).toBe(0.18);
    expect(result.prices.get("a-btc")).toBe(63014.5);
  });

  it("reports coins missing from the grouped response without failing the run", async () => {
    fetchMock.mockResolvedValueOnce(grouped([{ T: "X:ADAUSD", c: 0.18 }]));

    const result = await fetchMassivePrices([ADA, BTC], NOW);

    expect(result.prices.get("a-ada")).toBe(0.18);
    expect(result.prices.has("a-btc")).toBe(false);
    expect(result.errors.join(" ")).toContain("BTC");
  });

  it("rejects a zero price rather than valuing the holding at nothing", async () => {
    fetchMock.mockResolvedValueOnce(grouped([{ T: "X:ADAUSD", c: 0 }]));

    const result = await fetchMassivePrices([ADA], NOW);

    expect(result.prices.has("a-ada")).toBe(false);
  });

  it("defers the overflow past the rate limit and says so", async () => {
    const indices = Array.from({ length: 7 }, (_, i) => ({
      id: `a-${i}`,
      symbol: `IDX${i}`,
      externalId: `I:IDX${i}`,
    }));
    fetchMock.mockImplementation(async (url: string) => {
      const ticker = decodeURIComponent(String(url).split("/ticker/")[1].split("/")[0]);
      return prev(ticker, 100);
    });

    const result = await fetchMassivePrices(indices, NOW);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.prices.size).toBe(5);
    expect(result.skipped).toBe(2);
    expect(result.errors.join(" ")).toContain("rate limit");
  });

  it("survives a provider outage without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    const result = await fetchMassivePrices([ADA, SPX], NOW);

    expect(result.prices.size).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("does nothing but report when the key is missing", async () => {
    delete process.env.MASSIVE_API_KEY;

    const result = await fetchMassivePrices([ADA], NOW);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual(["MASSIVE_API_KEY is not set"]);
  });

  it("honours a base URL override", async () => {
    process.env.MASSIVE_API_BASE_URL = "https://rest.massive.com";
    fetchMock.mockResolvedValueOnce(grouped([{ T: "X:ADAUSD", c: 0.18 }]));

    await fetchMassivePrices([ADA], NOW);

    expect(String(fetchMock.mock.calls[0][0])).toContain("https://rest.massive.com/v2/");
  });
});
