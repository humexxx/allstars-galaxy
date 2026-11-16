// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwnerKpiGrid } from "./owner-kpi-grid";

const BOOK = { contributed: 37000, deployed: 36886.87, liability: 21524.64 };

describe("OwnerKpiGrid", () => {
  it("shows what came in and what is owed on it", () => {
    render(<OwnerKpiGrid kpis={BOOK} hideValues={false} />);

    expect(screen.getByText("$37,000.00")).toBeInTheDocument();
    expect(screen.getByText("$21,524.64")).toBeInTheDocument();
    expect(screen.getByText("58.2%")).toBeInTheDocument();
    expect(screen.getByText("Allocations cover 171% of it")).toBeInTheDocument();
  });

  it("leaves today's worth and the margin to the chart", () => {
    render(<OwnerKpiGrid kpis={BOOK} hideValues={false} />);

    expect(screen.queryByText("Allocations today")).not.toBeInTheDocument();
    expect(screen.queryByText("Margin")).not.toBeInTheDocument();
    expect(screen.queryByText("$36,886.87")).not.toBeInTheDocument();
  });

  it("puts no share beside Contributed", () => {
    // It is the base the other figures are measured against: its own share
    // is 100% whatever the book holds, which says nothing.
    render(<OwnerKpiGrid kpis={BOOK} hideValues={false} />);

    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("reads an empty book as empty", () => {
    render(<OwnerKpiGrid kpis={{ contributed: 0, deployed: 0, liability: 0 }} hideValues={false} />);

    expect(screen.getAllByText("$0.00")).toHaveLength(2);
    expect(screen.getByText("No outside investors yet")).toBeInTheDocument();
  });

  it("does not say unpriced allocations cover 0% of the debt", () => {
    render(
      <OwnerKpiGrid
        kpis={{ contributed: 2500, deployed: 0, liability: 2000 }}
        priced={false}
        hideValues={false}
      />
    );

    expect(screen.getByText("Their promised return")).toBeInTheDocument();
    expect(screen.queryByText(/cover/)).not.toBeInTheDocument();
  });

  it("masks the amounts and keeps the share", () => {
    const { container } = render(<OwnerKpiGrid kpis={BOOK} hideValues />);

    expect(container.textContent).not.toContain("$37,000.00");
    expect(screen.getByText("58.2%")).toBeInTheDocument();
  });
});
