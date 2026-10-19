// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TransactionTableRow } from "@/types/portfolio";

import { TransactionsTable } from "./transactions-table";

const ROW: TransactionTableRow = {
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

// The component renders a list for narrow containers and a table for wide
// ones (CSS container queries pick one); jsdom applies no CSS, so both are in
// the DOM. Assertions scope to the table or to the list explicitly.
const table = () => within(screen.getByRole("table"));
const list = () => within(screen.getByRole("list"));

describe("TransactionsTable", () => {
  it("hides the status column by default", () => {
    // The list is filtered to approved, so a column reading "approved" on
    // every line is a column of noise.
    render(<TransactionsTable rows={[ROW]} />);

    expect(table().queryByText("Status")).not.toBeInTheDocument();
  });

  it("shows the status column in the detailed view", () => {
    render(<TransactionsTable rows={[ROW]} showStatus />);

    expect(table().getByText("Status")).toBeInTheDocument();
  });

  it("shows what the contribution bought, at that day's price", () => {
    render(<TransactionsTable rows={[ROW]} />);

    expect(table().getByText(/1,232\.44 ADA/)).toBeInTheDocument();
    expect(table().getByText(/@ \$0\.81/)).toBeInTheDocument();
  });

  it("reports P/L against what was invested, with its share", () => {
    // 1232.44 ADA bought for $1,000, now worth $0.1763 = $217.28.
    render(<TransactionsTable rows={[ROW]} />);

    expect(table().getByText("-$782.72")).toBeInTheDocument();
    expect(table().getByText("-78.3%")).toBeInTheDocument();
  });

  it("adds the investor column only when asked", () => {
    const { rerender } = render(<TransactionsTable rows={[ROW]} />);
    expect(table().queryByText("Investor")).not.toBeInTheDocument();

    rerender(
      <TransactionsTable rows={[{ ...ROW, investorName: "Yalena" }]} showInvestor />
    );
    expect(table().getByText("Investor")).toBeInTheDocument();
    expect(table().getByText("Yalena")).toBeInTheDocument();
  });

  it("says an approved contribution is unpriced rather than implying it bought nothing", () => {
    render(<TransactionsTable rows={[{ ...ROW, allocations: [] }]} />);

    expect(table().getByText("not priced yet")).toBeInTheDocument();
  });

  it("does not call a pending row unpriced — nothing was bought yet", () => {
    // "not priced" on a row waiting for approval read like a fault.
    render(
      <TransactionsTable
        rows={[{ ...ROW, status: "pending", initialValue: null, currentValue: null, allocations: [] }]}
        showStatus
      />
    );

    expect(screen.queryByText(/not priced/)).not.toBeInTheDocument();
  });

  it("keeps fractional units precise instead of rounding them to two decimals", () => {
    // 0.01637 BTC used to print as "0.02 BTC" — a 22% error on the position.
    render(
      <TransactionsTable
        rows={[
          {
            ...ROW,
            allocations: [
              { symbol: "BTC", quantity: 0.01637044, invested: 1750, priceAtPurchase: 106900, price: 84350 },
            ],
          },
        ]}
      />
    );

    expect(table().getByText(/0\.01637 BTC/)).toBeInTheDocument();
  });

  it("drops the position columns for someone who does not run the method", () => {
    // Where a client's money is deployed is the owner's private half of the
    // deal: no Bought / Worth now / P/L, and the row reads as a balance.
    render(
      <TransactionsTable rows={[{ ...ROW, allocations: [] }]} showPositions={false} balanceLabel="Balance" />
    );

    expect(table().queryByText("Bought")).not.toBeInTheDocument();
    expect(table().queryByText("Worth now")).not.toBeInTheDocument();
    expect(table().queryByText("P/L")).not.toBeInTheDocument();
    expect(table().getByText("Balance")).toBeInTheDocument();
    expect(list().queryByText("Bought")).not.toBeInTheDocument();
  });

  it("adds back what was withdrawn before measuring growth", () => {
    // 10,000 grew to 10,008.28, then 1,000 was withdrawn: the stored value is
    // 9,008.28. That is +0.1%, not the -9.9% it used to show.
    render(
      <TransactionsTable
        rows={[
          {
            ...ROW,
            total: "10000.00",
            initialValue: "10000.00",
            currentValue: "9008.28",
            withdrawn: 1000,
            allocations: [],
          },
        ]}
        showPositions={false}
      />
    );

    expect(table().getByText("+0.1%")).toBeInTheDocument();
    expect(screen.queryByText("-9.9%")).not.toBeInTheDocument();
  });

  it("masks units along with amounts — units times the price is the amount", () => {
    const { container } = render(<TransactionsTable rows={[ROW]} hideValues />);

    expect(container.textContent).not.toContain("1,232.44");
    expect(container.textContent).not.toContain("$1,000.00");
    expect(table().getByText(/ADA/)).toBeInTheDocument();
  });
});
