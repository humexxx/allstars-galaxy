import { describe, expect, it, vi } from "vitest";

/**
 * `getMethodInvestors` is one query plus a reduce. We stub the query at the
 * `@/db` boundary and assert the reduce — the part that decides which rows
 * count and how they group.
 */
const rows: Record<string, unknown>[] = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: async () => rows,
            }),
          }),
        }),
      }),
    }),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {},
  },
}));

import { getMethodInvestors } from "./portfolio-service";

function row(over: Record<string, unknown>) {
  return {
    methodId: "m1",
    methodName: "Safe Investment",
    methodEnabled: true,
    investorId: "u1",
    investorEmail: "a@x.com",
    investorName: "Ana",
    type: "buy",
    status: "approved",
    total: "0",
    initialValue: "0",
    currentValue: "0",
    ...over,
  };
}

describe("getMethodInvestors", () => {
  it("sums approved buys per investor and ignores other statuses", async () => {
    rows.length = 0;
    rows.push(
      row({ initialValue: "1000", currentValue: "1050.05" }),
      row({
        investorId: "u2",
        investorEmail: "b@x.com",
        investorName: "Bea",
        initialValue: "1650",
        currentValue: "1794.05",
      }),
      row({
        investorId: "u2",
        investorEmail: "b@x.com",
        initialValue: "750",
        currentValue: "793.04",
      }),
      // Neither of these may move a number.
      row({ investorId: "u2", status: "rejected", initialValue: "9999" }),
      row({ investorId: "u2", status: "pending", initialValue: "5555" })
    );

    const [method] = await getMethodInvestors("owner-1");

    expect(method.totalInvested).toBeCloseTo(3400, 2);
    expect(method.totalHolding).toBeCloseTo(3637.14, 2);
    // Biggest holder first.
    expect(method.investors.map((i) => i.email)).toEqual([
      "b@x.com",
      "a@x.com",
    ]);
    expect(method.investors[0].invested).toBeCloseTo(2400, 2);
    expect(method.investors[0].holding).toBeCloseTo(2587.09, 2);
  });

  it("keeps withdrawals out of the holding figure", async () => {
    rows.length = 0;
    rows.push(
      row({ initialValue: "1000", currentValue: "1100" }),
      row({ type: "withdrawal", total: "300" })
    );

    const [method] = await getMethodInvestors("owner-1");

    expect(method.investors[0].holding).toBeCloseTo(1100, 2);
    expect(method.investors[0].withdrawn).toBeCloseTo(300, 2);
    expect(method.totalHolding).toBeCloseTo(1100, 2);
  });

  it("lists an owned method with no transactions at all", async () => {
    rows.length = 0;
    rows.push(row({ investorId: null, type: null, status: null }));

    const [method] = await getMethodInvestors("owner-1");

    expect(method.investors).toEqual([]);
    expect(method.totalHolding).toBe(0);
  });
});
