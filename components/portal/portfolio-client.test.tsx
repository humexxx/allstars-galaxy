// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
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
vi.mock("@/app/actions/price-refresh", () => ({ refreshPricesAction: vi.fn() }));

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
  priceFreshness: { quotes: [], schedule: null },
  currentUserId: "me",
};

describe("PortfolioClientPage — an empty book is the same page at zero", () => {
  it("an owner whose methods hold no money gets the owner figures at $0.00, no 100%", () => {
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

    expect(screen.getByText("Owed to investors")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
    // A share of nothing is not 100%.
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("an investor with nothing approved gets the same grid, at zero", () => {
    render(<PortfolioClientPage data={base} />);

    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.queryByText("Your portfolio is empty")).not.toBeInTheDocument();
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

    expect(screen.getByText(/Your first transaction is waiting for an admin/)).toBeInTheDocument();
    expect(screen.getByText("Total value")).toBeInTheDocument();
  });
});

describe("PortfolioClientPage — transactions tab", () => {
  const investor = (id: string, name: string) => ({
    investorId: id,
    name,
    isOwn: false,
    contributed: 1000,
    withdrawn: 0,
    owed: 1050,
    positions: [],
    positionValue: 800,
    profitLoss: -250,
  });
  const movement = (id: string, investorId: string, investorName: string, status: "approved" | "rejected") => ({
    id,
    date: "2025-09-30T06:00:00.000Z",
    methodName: "Steady Income",
    investorId,
    investorName,
    type: "buy" as const,
    status,
    total: "1000.00",
    initialValue: "1000.00",
    currentValue: "1050.00",
    allocations: [],
  });

  // An owner with no movements of their own and two investors.
  const owner: Data = {
    ...base,
    methodInvestors: [
      {
        methodId: "m1",
        methodName: "Steady Income",
        enabled: true,
        investors: [],
        totalInvested: 2000,
        totalHolding: 1600,
      },
    ],
    investorBreakdown: [investor("y", "Yalena Hume"), investor("m", "María Pérez")],
    investorTransactions: [
      movement("t1", "y", "Yalena Hume", "approved"),
      movement("t2", "y", "Yalena Hume", "rejected"),
      movement("t3", "m", "María Pérez", "approved"),
    ],
  };

  const openTransactions = (): void => {
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Transactions" }));
  };
  const investorTable = () => within(screen.getAllByRole("table").at(-1)!);

  it("has no detailed-view toggle and counts only movements that moved money", () => {
    render(<PortfolioClientPage data={owner} />);
    openTransactions();

    expect(screen.queryByRole("button", { name: /detailed view/i })).not.toBeInTheDocument();
    // Yalena's rejected row is not a movement.
    const yalenaRow = investorTable().getByRole("button", { name: /yalena hume/i }).closest("tr")!;
    expect(within(yalenaRow).getByText("1")).toBeInTheDocument();
  });

  it("filters the investors by name, accents or not", () => {
    render(<PortfolioClientPage data={owner} />);
    openTransactions();

    fireEvent.change(screen.getByRole("textbox", { name: /filter investors/i }), {
      target: { value: "maria" },
    });
    expect(investorTable().getByText("María Pérez")).toBeInTheDocument();
    expect(investorTable().queryByText("Yalena Hume")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /filter investors/i }), {
      target: { value: "nobody" },
    });
    expect(screen.getByText("No investor matches your filter")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(investorTable().getByText("Yalena Hume")).toBeInTheDocument();
  });

  it("can export the investors' rows when the owner has none of their own", () => {
    render(<PortfolioClientPage data={owner} />);

    expect(screen.getByRole("link", { name: /export csv/i })).toHaveAttribute(
      "href",
      "/api/portfolio/export"
    );
  });
});
