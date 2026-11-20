import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const order: string[] = [];

vi.mock("@/lib/cron-auth", () => ({ isCronAuthorized: () => true }));
vi.mock("@/lib/services/app-state-service", () => ({ setAppState: vi.fn(async () => undefined) }));
vi.mock("@/lib/services/allocation-service", () => ({
  backfillAllOwners: vi.fn(async () => {
    order.push("backfill");
    return { priced: 1, skipped: 0, errors: ["BTC: historical pricing unsupported for source coingecko"], massiveCalls: 2 };
  }),
}));
vi.mock("@/lib/services/price-service", () => ({
  refreshPrices: vi.fn(async () => {
    order.push("refresh");
    return { fetched: 3, skipped: 0, errors: [] };
  }),
}));

import { backfillAllOwners } from "@/lib/services/allocation-service";
import { setAppState } from "@/lib/services/app-state-service";
import { refreshPrices } from "@/lib/services/price-service";
import { GET } from "./route";

const request = { headers: new Headers({ authorization: "Bearer x" }) } as unknown as NextRequest;

afterEach(() => {
  order.length = 0;
  vi.clearAllMocks();
});

describe("GET /api/cron/prices", () => {
  it("backfills first and gives the refresh what is left of Massive's budget", async () => {
    const res = await GET(request);

    expect(res.status).toBe(200);
    expect(order).toEqual(["backfill", "refresh"]);
    expect(refreshPrices).toHaveBeenCalledWith({ massiveCalls: 3 });
    const body = await res.json();
    expect(body.backfill).not.toHaveProperty("massiveCalls");
  });

  it("records the run with its problems in app_state", async () => {
    await GET(request);
    expect(setAppState).toHaveBeenCalledWith(
      "last_price_run",
      expect.any(String),
      "BTC: historical pricing unsupported for source coingecko"
    );
  });

  it("records a failed run too", async () => {
    vi.mocked(backfillAllOwners).mockRejectedValueOnce(new Error("db down"));
    const res = await GET(request);
    expect(res.status).toBe(500);
    expect(setAppState).toHaveBeenCalledWith("last_price_run", expect.any(String), "db down");
  });
});
