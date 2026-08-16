// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarginChart, type MarginHistoryInputView } from "./margin-chart";

// Recharts needs layout, which jsdom does not do; the chart body is not what
// these assertions are about.
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Area: Stub, AreaChart: Stub, CartesianGrid: Stub, Legend: Stub,
    ReferenceLine: Stub, XAxis: Stub, YAxis: Stub,
  };
});
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const INPUT: MarginHistoryInputView = {
  contributions: [
    { month: "2025-08", assetId: "ada", quantity: 1000, amount: 800, investorId: "y", methodId: "m1" },
    { month: "2025-09", assetId: "ada", quantity: 1000, amount: 800, investorId: "j", methodId: "m1" },
  ],
  liabilities: [
    { month: "2025-08", currentValue: 900, monthlyRoi: 0, isOwn: false, investorId: "y", methodId: "m1" },
    { month: "2025-09", currentValue: 900, monthlyRoi: 0, isOwn: true, investorId: "j", methodId: "m1" },
  ],
  prices: [
    ["ada|2025-08", 0.8], ["ada|2025-09", 0.7], ["ada|2025-10", 0.6],
    ["ada|2025-11", 0.5], ["ada|2025-12", 0.4],
  ],
  today: "2025-12",
  investors: [
    { id: "y", name: "Yalena", isOwn: false },
    { id: "j", name: "Jason", isOwn: true },
  ],
  methods: [{ id: "m1", name: "Safe Investment" }],
};

describe("MarginChart", () => {
  it("offers a date range beside the filters", () => {
    render(<MarginChart input={INPUT} />);

    expect(screen.getByRole("group", { name: "Date range" })).toBeInTheDocument();
    for (const label of ["3M", "6M", "1Y", "All"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("shows the margin as deployed against owed", () => {
    // 2000 ADA at 0.40 = 800 deployed, against 900 owed to Yalena. Jason's own
    // 900 is capital, not debt.
    render(<MarginChart input={INPUT} />);

    expect(screen.getByText("-$100.00")).toBeInTheDocument();
    expect(screen.getByText(/\$800\.00 deployed against \$900\.00 owed/)).toBeInTheDocument();
  });

  it("masks the amounts but keeps the chart readable", () => {
    const { container } = render(<MarginChart input={INPUT} hideValues />);

    expect(container.textContent).not.toContain("$800.00");
    expect(container.textContent).toMatch(/•{3,}/);
  });

  it("says so when a filter leaves nothing to plot", () => {
    render(
      <MarginChart
        input={{ ...INPUT, contributions: [], liabilities: [] }}
      />
    );

    expect(screen.getByText(/not enough history/i)).toBeInTheDocument();
  });
});
