// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/dev-tools/dev-tools-context", () => ({ useRegisterDevTool: vi.fn() }));
vi.mock("@/app/actions/transactions", () => ({ createTransactionAction: vi.fn() }));
vi.mock("@/app/actions/portfolio-snapshots", () => ({
  createManualSnapshotAction: vi.fn(),
  deleteManualSnapshotsAction: vi.fn(),
}));
vi.mock("@/app/actions/allocations", () => ({
  repriceContributionsAction: vi.fn(),
  setAllocationsAction: vi.fn(),
  updateMethodAction: vi.fn(),
}));

import PortfolioClientPage from "./portfolio-client";

type Data = ComponentProps<typeof PortfolioClientPage>["data"];

const METHOD = {
  id: "m1",
  name: "Steady Income",
  description: null,
  ownerUserId: "me",
  riskLevel: "Low",
  monthlyRoi: "0.7000",
  enabled: true,
  createdAt: null,
  updatedAt: new Date("2026-01-01"),
} as Data["methods"][number];

const EMPTY_STATS = {
  totalValue: 0,
  costBasis: 0,
  totalWithdrawn: 0,
  allTimeProfit: 0,
  allTimeProfitPercentage: 0,
  totalInvestmentMethods: 0,
  activeTransactions: 0,
};

const base: Data = {
  portfolio: { id: "p1", name: "My Main Portfolio" },
  stats: EMPTY_STATS,
  transactions: [],
  chartData: [],
  cashFlows: [],
  methods: [METHOD],
  isAdmin: false,
  users: [],
  methodInvestors: [],
  priceAssets: [],
  methodAllocations: [],
  investorTransactions: [],
  transactionRows: [],
  marginHistory: [],
  marginHistoryInput: {
    contributions: [],
    liabilities: [],
    cashFlows: [],
    prices: [],
    today: "2026-10",
    investors: [],
    methods: [],
  },
  investorBreakdown: [],
  marginStatus: { unconfigured: true, unpriced: 0 },
  currentUserId: "me",
};

describe("PortfolioClientPage — empty books read as empty, not as zeros", () => {
  it("an owner whose methods hold no money gets an empty state, not $0.00 100%", () => {
    render(
      <PortfolioClientPage
        data={{
          ...base,
          methodInvestors: [
            {
              methodId: "m1",
              methodName: "Steady Income",
              enabled: true,
              investors: [],
              totalInvested: 0,
              totalHolding: 0,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("No money in your methods yet")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("an investor with nothing approved gets an empty state, not a grid of zeros", () => {
    render(<PortfolioClientPage data={base} />);

    expect(screen.getByText("Your portfolio is empty")).toBeInTheDocument();
    expect(screen.queryByText("Total value")).not.toBeInTheDocument();
  });

  it("says a first transaction is waiting rather than empty", () => {
    render(
      <PortfolioClientPage
        data={{
          ...base,
          transactions: [
            {
              id: "t1",
              type: "buy",
              amount: "100.00",
              fee: "0.00",
              total: "100.00",
              initialValue: null,
              currentValue: null,
              date: new Date("2026-09-30T15:00:00Z"),
              status: "pending",
              notes: null,
              sourceTransactionId: null,
              investmentMethod: METHOD,
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
  });
});
