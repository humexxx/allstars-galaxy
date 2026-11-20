import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCoinGeckoPrices } from "./coingecko";

const BTC = { id: "a-btc", symbol: "BTC", externalId: "bitcoin" };
const ADA = { id: "a-ada", symbol: "ADA", externalId: "cardano" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("fetchCoinGeckoPrices", () => {
  it("quotes every id from one request", async () => {
    fetchMock.mockResolvedValueOnce(ok({ bitcoin: { usd: 63000 }, cardano: { usd: 0.18 } }));

    const result = await fetchCoinGeckoPrices([BTC, ADA]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.prices).toEqual(new Map([["a-btc", 63000], ["a-ada", 0.18]]));
    expect(result.errors).toEqual([]);
  });

  it("reports a 200 whose body is null instead of throwing", async () => {
    // It threw past refreshPrices and discarded Massive's quotes with it.
    fetchMock.mockResolvedValueOnce(ok(null));

    const result = await fetchCoinGeckoPrices([BTC]);

    expect(result).toEqual({ prices: new Map(), skipped: 1, errors: ["coingecko returned no prices"] });
  });

  it("skips an entry that is not an object", async () => {
    fetchMock.mockResolvedValueOnce(ok({ bitcoin: null, cardano: { usd: 0.18 } }));

    const result = await fetchCoinGeckoPrices([BTC, ADA]);

    expect(result.prices).toEqual(new Map([["a-ada", 0.18]]));
    expect(result.errors).toEqual(["no price for BTC"]);
  });

  it("carries the shared upstream deadline", async () => {
    fetchMock.mockResolvedValueOnce(ok({}));

    await fetchCoinGeckoPrices([BTC]);

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
