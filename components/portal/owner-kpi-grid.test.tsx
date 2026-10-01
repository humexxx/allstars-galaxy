// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwnerKpiGrid } from "./owner-kpi-grid";

const BOOK = {
  contributed: 37000,
  deployed: 36886.87,
  liability: 21524.64,
  margin: 15362.23,
  monthlyChange: -154.45,
};

describe("OwnerKpiGrid", () => {
  it("shows the four figures and their shares", () => {
    render(<OwnerKpiGrid kpis={BOOK} hideValues={false} />);

    expect(screen.getByText("$37,000.00")).toBeInTheDocument();
    expect(screen.getByText("$36,886.87")).toBeInTheDocument();
    expect(screen.getByText("-0.3%")).toBeInTheDocument();
    expect(screen.getByText("$21,524.64")).toBeInTheDocument();
    expect(screen.getByText("Allocations cover 171% of it")).toBeInTheDocument();
    expect(screen.getByText("$15,362.23")).toBeInTheDocument();
    expect(screen.getByText("+71.4%")).toBeInTheDocument();
  });

  it("does not stamp 100% on nothing", () => {
    // "Contributed $0.00 100%" read as a result rather than an empty book.
    render(
      <OwnerKpiGrid
        kpis={{ contributed: 0, deployed: 0, liability: 0, margin: 0, monthlyChange: null }}
        hideValues={false}
      />
    );

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.getByText("No outside investors yet")).toBeInTheDocument();
  });

  it("says unpriced allocations are unknown instead of showing $0 and a loss", () => {
    // 2,500 came in, none of it priced: Allocations are not $0 and the margin
    // is not -$2,500 — they are not known yet.
    render(
      <OwnerKpiGrid
        kpis={{ contributed: 2500, deployed: 0, liability: 0, margin: 0, monthlyChange: null }}
        priced={false}
        hideValues={false}
      />
    );

    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("Not priced yet")).toBeInTheDocument();
    expect(screen.getByText("Needs priced allocations")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
