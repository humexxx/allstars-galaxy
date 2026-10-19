import { describe, expect, it, vi } from "vitest";

// Only the pure builders are under test; the queries are not reached.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./allocation-service", () => ({ getDerivedHoldings: vi.fn() }));
vi.mock("./portfolio-service", () => ({ getMethodInvestors: vi.fn() }));

import { buildMarginHistory } from "@/lib/finance/margin-history";

import { buildHistoryInput, buildInvestors, type AllocRow, type TxRow } from "./margin-service";

const OWNER = "owner";
const MARIA = "maria";
const GROWTH = "growth";

const tx = (over: Partial<TxRow>): TxRow => ({
  txId: "t",
  methodId: GROWTH,
  type: "buy",
  date: "2026-03-05T15:00:00Z",
  total: "10000.00",
  initialValue: "10000.00",
  currentValue: "9008.28",
  sourceTransactionId: null,
  investorId: MARIA,
  fullName: "María Fernández",
  email: "maria@example.test",
  ...over,
});

const alloc = (over: Partial<AllocRow>): AllocRow => ({
  transactionId: "buy",
  methodId: GROWTH,
  assetId: "spy",
  quantity: "10",
  amount: "6000",
  priceAtPurchase: "600",
  pricedOn: new Date("2026-03-05T00:00:00Z"),
  symbol: "SPY",
  name: "SPDR S&P 500 ETF Trust",
  ...over,
});

const BUY = tx({ txId: "buy" });
const WITHDRAWAL = tx({
  txId: "wd",
  type: "withdrawal",
  date: "2026-09-08T15:00:00Z",
  total: "1000.00",
  initialValue: null,
  currentValue: null,
  sourceTransactionId: "buy",
});

describe("buildInvestors", () => {
  it("nets withdrawals out of what a person contributed and of what they hold", () => {
    // A withdrawal SELLS units. Leaving its negative units out kept them in the
    // investor's position and overstated their money by the amount withdrawn;
    // a gross "contributed" made the promise read -6.6% when it had grown.
    const rows = buildInvestors(
      [BUY, WITHDRAWAL],
      [
        alloc({ transactionId: "buy", quantity: "10", amount: "6000" }),
        alloc({ transactionId: "wd", quantity: "-1", amount: "-700" }),
      ],
      new Map([["spy", 700]]),
      OWNER
    );

    expect(rows).toHaveLength(1);
    const maria = rows[0];
    expect(maria.contributed).toBe(9000);
    expect(maria.withdrawn).toBe(1000);
    expect(maria.owed).toBeCloseTo(9008.28, 6);
    expect(maria.positions[0].quantity).toBe(9);
    expect(maria.positionValue).toBe(6300);
    expect(maria.profitLoss).toBeCloseTo(6300 - 9008.28, 6);
  });
});

describe("buildHistoryInput", () => {
  const input = buildHistoryInput({
    owned: [{ id: GROWTH, name: "Growth Basket" }],
    txRows: [BUY, WITHDRAWAL, tx({ txId: "own", investorId: OWNER, date: "2026-04-02T00:00:00Z", total: "8000.00", initialValue: "8000.00", currentValue: "8000.00" })],
    // Nothing priced at all.
    allocRows: [],
    roiByMethod: new Map([[GROWTH, 0.00012]]),
    monthly: new Map(),
    ownerUserId: OWNER,
    today: "2026-10",
  });

  it("counts every contribution's cash, priced or not", () => {
    const series = buildMarginHistory({ ...input, prices: new Map(input.prices) });

    // 10,000 + 8,000 in, 1,000 out — with no allocation rows at all, which is
    // exactly when the old headline read "Contributed $0.00".
    expect(series.at(-1)!.invested).toBe(17000);
    expect(series.at(-1)!.deployed).toBe(0);
  });

  it("keeps the withdrawn money owed until the month it left", () => {
    const series = buildMarginHistory({ ...input, prices: new Map(input.prices) });
    const aug = series.find((p) => p.month === "2026-08")!;
    const sep = series.find((p) => p.month === "2026-09")!;

    // 10,000 compounding at 0.012%/month from March: five periods by August.
    expect(aug.liability).toBeCloseTo(10000 * Math.pow(1.00012, 5), 1);
    // September is after the withdrawal: the stored balance, one period back.
    expect(sep.liability).toBeCloseTo(9008.28 / 1.00012, 6);
    // The owner's own stake (8,000 today) is capital, never debt.
    expect(sep.ownPosition).toBeCloseTo(8000 / 1.00012, 6);
  });

  it("tags cash flows with investor and method so the chart filter can use them", () => {
    expect(input.cashFlows).toContainEqual({
      month: "2026-09",
      amount: -1000,
      investorId: MARIA,
      methodId: GROWTH,
    });
  });
});
