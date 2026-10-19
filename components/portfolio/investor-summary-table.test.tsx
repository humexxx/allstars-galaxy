// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

// A list for narrow containers and a table for wide ones are both in jsdom's
// DOM (no CSS); assertions scope to one of them.
const table = () => within(screen.getByRole("table"));

describe("InvestorSummaryTable", () => {
  it("summarises the relationship in one row", () => {
    render(<InvestorSummaryTable rows={[YALENA]} />);

    expect(table().getByText("Yalena Hume")).toBeInTheDocument();
    expect(table().getByText("5")).toBeInTheDocument();
    expect(table().getByText("$6,700.00")).toBeInTheDocument();
    expect(table().getByText("-$5,123.08")).toBeInTheDocument();
  });

  it("calls worth minus owed a margin, not P/L", () => {
    // Beside a transactions table whose P/L is value against cost, one
    // heading meant two different quantities on one screen.
    render(<InvestorSummaryTable rows={[YALENA]} />);

    expect(table().getByText("Margin")).toBeInTheDocument();
    expect(table().queryByText("P/L")).not.toBeInTheDocument();
  });

  it("measures worth and owed against the cash in, the margin against what is owed", () => {
    // Margin as a share of what is owed — the same base as the Margin card.
    render(<InvestorSummaryTable rows={[YALENA]} />);

    expect(table().getByText("-67.8%")).toBeInTheDocument(); // worth now vs cash in
    expect(table().getByText("+8.6%")).toBeInTheDocument(); // owed has grown
    expect(table().getByText("-70.4%")).toBeInTheDocument(); // margin vs owed
  });

  it("masks the amounts but keeps the shares", () => {
    const { container } = render(<InvestorSummaryTable rows={[YALENA]} hideValues />);

    expect(container.textContent).not.toContain("6,700");
    expect(container.textContent).toContain("-70.4%");
  });

  it("explains itself with nobody invested", () => {
    render(<InvestorSummaryTable rows={[]} />);

    expect(screen.getByText(/no outside investors yet/i)).toBeInTheDocument();
  });
});
