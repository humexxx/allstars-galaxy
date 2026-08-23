// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransactionsTable, type TransactionRow } from "./transactions-table";

const ROW: TransactionRow = {
  id: "t1",
  date: "2025-08-31T00:00:00.000Z",
  methodName: "Safe Investment",
  type: "buy",
  status: "approved",
  total: "1000.00",
  initialValue: "1000.00",
  currentValue: "1102.59",
  allocations: [
    {
      symbol: "ADA",
      quantity: 1232.44,
      invested: 1000,
      priceAtPurchase: 0.8114,
      price: 0.1763,
    },
  ],
};

describe("TransactionsTable", () => {
  it("hides the status column by default", () => {
    // The list is filtered to approved, so a column reading "approved" on
    // every line is a column of noise.
    render(<TransactionsTable rows={[ROW]} />);

    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("shows the status column in the detailed view", () => {
    render(<TransactionsTable rows={[ROW]} showStatus />);

    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("shows what the contribution bought, at that day's price", () => {
    render(<TransactionsTable rows={[ROW]} />);

    expect(screen.getByText(/1,232\.44 ADA/)).toBeInTheDocument();
    expect(screen.getByText(/@ \$0\.81/)).toBeInTheDocument();
  });

  it("reports P/L against what was invested, with its share", () => {
    // 1232.44 ADA bought for $1,000, now worth $0.1763 = $217.28.
    render(<TransactionsTable rows={[ROW]} />);

    expect(screen.getByText("-$782.72")).toBeInTheDocument();
    expect(screen.getByText("-78.3%")).toBeInTheDocument();
  });

  it("adds the investor column only when asked", () => {
    const { rerender } = render(<TransactionsTable rows={[ROW]} />);
    expect(screen.queryByText("Investor")).not.toBeInTheDocument();

    rerender(
      <TransactionsTable rows={[{ ...ROW, investorName: "Yalena" }]} showInvestor />
    );
    expect(screen.getByText("Investor")).toBeInTheDocument();
    expect(screen.getByText("Yalena")).toBeInTheDocument();
  });

  it("says a contribution is unpriced rather than implying it bought nothing", () => {
    render(<TransactionsTable rows={[{ ...ROW, allocations: [] }]} />);

    expect(screen.getByText("not priced")).toBeInTheDocument();
  });
});
