import { afterEach, describe, expect, it, vi } from "vitest";

// The real gate runs and only its sources are stubbed, so these read as
// "nobody is signed in" rather than "a helper returned null".
vi.mock("@/db", () => ({ db: {} }));

const getCurrentUserCached = vi.fn();
const getUserRoleCached = vi.fn();
vi.mock("@/lib/services/auth-server", () => ({
  getCurrentUserCached: (...args: unknown[]) => getCurrentUserCached(...args),
  getUserRoleCached: (...args: unknown[]) => getUserRoleCached(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/services/portfolio-service", () => ({
  getUserPortfolio: vi.fn(async () => null),
  getPortfolioTransactions: vi.fn(async () => []),
  getInvestorTransactions: vi.fn(async () => []),
}));
vi.mock("@/lib/services/allocation-service", () => ({
  getAllocationsByTransaction: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/services/price-service", () => ({
  getLatestPrices: vi.fn(async () => new Map()),
  listPriceAssets: vi.fn(async () => []),
}));
vi.mock("@/lib/services/investment-method-service", () => ({
  listAllInvestmentMethods: vi.fn(async () => []),
}));

import {
  getInvestorTransactions,
  getUserPortfolio,
} from "@/lib/services/portfolio-service";

import { GET } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/portfolio/export — auth gate", () => {
  it("answers 401 JSON when nobody is signed in, before reading anything", async () => {
    getCurrentUserCached.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(getUserPortfolio).not.toHaveBeenCalled();
    expect(getInvestorTransactions).not.toHaveBeenCalled();
  });

  it("lets a signed-in user through and reads their own rows", async () => {
    getCurrentUserCached.mockResolvedValueOnce({ id: USER_ID });
    getUserRoleCached.mockResolvedValueOnce("user");

    const response = await GET();

    // The stubs hold no portfolio and no investors, so getting past the gate
    // shows as the empty-export answer rather than a CSV.
    expect(response.status).toBe(404);
    expect(getUserPortfolio).toHaveBeenCalledWith(USER_ID);
    expect(getInvestorTransactions).toHaveBeenCalledWith(USER_ID);
  });
});
