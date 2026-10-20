import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));
vi.mock("@/lib/services/price-service", () => ({ refreshHeldPrices: vi.fn() }));

import { revalidatePath } from "next/cache";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { refreshHeldPrices } from "@/lib/services/price-service";

import { refreshPricesAction } from "./price-refresh";

const OWNER = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    effectiveUserId: OWNER,
  } as unknown as Awaited<ReturnType<typeof requireEffectiveContext>>);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("refreshPricesAction", () => {
  it("refreshes the effective user's prices and revalidates the page", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({
      status: "refreshed",
      requested: 2,
      fetched: 2,
      skipped: 0,
      errors: [],
    });

    const result = await refreshPricesAction();

    expect(refreshHeldPrices).toHaveBeenCalledWith(OWNER);
    expect(result).toEqual({
      success: true,
      data: { status: "refreshed", fetched: 2, missed: 0 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/portal/portfolio");
  });

  it("reports a partial refresh as the count that did not come back", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({
      status: "refreshed",
      requested: 3,
      fetched: 2,
      skipped: 0,
      errors: ["no close for SPY"],
    });

    expect(await refreshPricesAction()).toEqual({
      success: true,
      data: { status: "refreshed", fetched: 2, missed: 1 },
    });
  });

  it("fails without revalidating when the provider returned nothing", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({
      status: "refreshed",
      requested: 1,
      fetched: 0,
      skipped: 1,
      errors: ["massive 429 on /v2/aggs/ticker/SPY/prev"],
    });

    const result = await refreshPricesAction();

    expect(result).toEqual({
      success: false,
      error: "The price provider didn't answer. The last prices stay in place.",
    });
    // The raw provider error stays in the server log.
    expect(JSON.stringify(result)).not.toContain("429");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes on when newer prices can exist when everything is current", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({
      status: "current",
      newerAt: new Date("2026-10-21T00:00:00Z"),
    });

    expect(await refreshPricesAction()).toEqual({
      success: true,
      data: { status: "current", newerAt: "2026-10-21T00:00:00.000Z" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses inside the cooldown with the wait in minutes", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({
      status: "cooldown",
      retryAt: new Date(Date.now() + 3 * 60_000 + 10_000),
    });

    expect(await refreshPricesAction()).toEqual({
      success: false,
      error: "Prices were refreshed moments ago. Try again in 4 min.",
    });
  });

  it("refuses someone whose methods hold nothing", async () => {
    vi.mocked(refreshHeldPrices).mockResolvedValueOnce({ status: "nothing-held" });
    expect(await refreshPricesAction()).toEqual({
      success: false,
      error: "No priced holdings to refresh",
    });
  });

  it("does not reach the service without a session", async () => {
    vi.mocked(requireEffectiveContext).mockRejectedValueOnce(new Error("Unauthorized"));
    expect(await refreshPricesAction()).toEqual({ success: false, error: "Action failed" });
    expect(refreshHeldPrices).not.toHaveBeenCalled();
  });
});
