// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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

describe("InvestorSummaryTable", () => {
  it("summarises the relationship in one row", () => {
    render(<InvestorSummaryTable rows={[YALENA]} />);

    expect(screen.getByText("Yalena Hume")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("$6,700.00")).toBeInTheDocument();
    expect(screen.getByText("-$5,123.08")).toBeInTheDocument();
  });

  it("measures every share against what was contributed", () => {
    // The same base the transactions table uses, so the two read alike.
    render(<InvestorSummaryTable rows={[YALENA]} />);

    expect(screen.getByText("-76.5%")).toBeInTheDocument();   // P/L
    expect(screen.getByText("-67.8%")).toBeInTheDocument();   // worth now
    expect(screen.getByText("+8.62%")).toBeInTheDocument();   // owed has grown
  });

  it("masks the amounts but keeps the shares", () => {
    const { container } = render(<InvestorSummaryTable rows={[YALENA]} hideValues />);

    expect(container.textContent).not.toContain("6,700");
    expect(container.textContent).toContain("-76.5%");
  });

  it("explains itself with nobody invested", () => {
    render(<InvestorSummaryTable rows={[]} />);

    expect(screen.getByText(/no outside investors yet/i)).toBeInTheDocument();
  });
});
