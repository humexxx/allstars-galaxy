// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TransactionTableRow } from "@/types/portfolio";

import { InvestorSummaryTable, type InvestorSummaryRow } from "./investor-summary-table";

const YALENA: InvestorSummaryRow = {
  investorId: "y",
  name: "Yalena Hume",
  movements: 5,
  contributed: 6700,
  owed: 7277.87,
  positionValue: 2154.79,
  profitLoss: -5123.08,
};

const movement = (over: Partial<TransactionTableRow>): TransactionTableRow => ({
  id: "t1",
  date: "2025-09-30T06:00:00.000Z",
  methodName: "Safe Investment",
  investorId: "y",
  investorName: "Yalena Hume",
  type: "buy",
  status: "approved",
  total: "1650.00",
  initialValue: "1650.00",
  currentValue: "1844.81",
  allocations: [],
  ...over,
});

const NONE = new Map<string, TransactionTableRow[]>();

// A list for narrow containers and a table for wide ones are both in jsdom's
// DOM (no CSS); assertions scope to one of them.
const table = () => within(screen.getAllByRole("table")[0]);

describe("InvestorSummaryTable", () => {
  it("summarises the relationship in one row", () => {
    render(<InvestorSummaryTable rows={[YALENA]} movements={NONE} />);

    expect(table().getByText("Yalena Hume")).toBeInTheDocument();
    expect(table().getByText("5")).toBeInTheDocument();
    expect(table().getByText("$6,700.00")).toBeInTheDocument();
    expect(table().getByText("-$5,123.08")).toBeInTheDocument();
  });

  it("calls worth minus owed a margin, not P/L", () => {
    // Beside a transactions table whose P/L is value against cost, one
    // heading meant two different quantities on one screen.
    render(<InvestorSummaryTable rows={[YALENA]} movements={NONE} />);

    expect(table().getByText("Margin")).toBeInTheDocument();
    expect(table().queryByText("P/L")).not.toBeInTheDocument();
  });

  it("measures worth and owed against the cash in, the margin against what is owed", () => {
    // Margin as a share of what is owed — the same base as the Margin card.
    render(<InvestorSummaryTable rows={[YALENA]} movements={NONE} />);

    expect(table().getByText("-67.8%")).toBeInTheDocument(); // worth now vs cash in
    expect(table().getByText("+8.6%")).toBeInTheDocument(); // owed has grown
    expect(table().getByText("-70.4%")).toBeInTheDocument(); // margin vs owed
  });

  it("masks the amounts but keeps the shares", () => {
    const { container } = render(<InvestorSummaryTable rows={[YALENA]} movements={NONE} hideValues />);

    expect(container.textContent).not.toContain("6,700");
    expect(container.textContent).toContain("-70.4%");
  });

  it("opens a person to each of their movements", () => {
    const movements = new Map([
      [
        "y",
        [
          movement({ id: "a" }),
          movement({ id: "b", date: "2025-12-31T06:00:00.000Z", total: "750.00", status: "pending" }),
        ],
      ],
    ]);
    render(<InvestorSummaryTable rows={[YALENA]} movements={movements} />);

    const toggle = table().getByRole("button", { name: /yalena hume/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("$750.00")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = within(document.getElementById(toggle.getAttribute("aria-controls")!)!);
    expect(panel.getAllByText("$1,650.00").length).toBeGreaterThan(0);
    expect(panel.getAllByText("$750.00").length).toBeGreaterThan(0);
    // One of them is waiting on approval, so the status shows.
    expect(panel.getAllByText(/pending/i).length).toBeGreaterThan(0);

    fireEvent.click(toggle);
    expect(screen.queryByText("$750.00")).not.toBeInTheDocument();
  });

  it("explains itself with nobody invested", () => {
    render(<InvestorSummaryTable rows={[]} movements={NONE} />);

    expect(screen.getByText(/no outside investors yet/i)).toBeInTheDocument();
  });
});
