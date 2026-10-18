// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PeriodCompareDialog } from "./period-compare-dialog";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

describe("PeriodCompareDialog", () => {
  it("F13: counts the distance between the two points' dates", () => {
    // Today Sep 2026, clicked Jul 2026. It used to subtract row offsets from
    // two different projections and say "in 6 periods".
    render(
      <PeriodCompareDialog
        open
        onOpenChange={() => {}}
        anchorDay={1}
        todayLabel="Today Sep 10"
        todayPoint={{ date: U(2026, 9), netWorth: 15000, savings: 15000, investments: 0, totalDebt: 0 }}
        targetLabel="Jul 2026"
        targetPoint={{ date: U(2026, 7), netWorth: 11000, savings: 11000, investments: 0, totalDebt: 0 }}
      />
    );
    expect(screen.getByText(/2 periods ago/)).toBeInTheDocument();
  });

  it("F12: compares against the day-aware today point the reader clicked", () => {
    render(
      <PeriodCompareDialog
        open
        onOpenChange={() => {}}
        anchorDay={1}
        todayLabel="Today Sep 10"
        todayPoint={{ date: U(2026, 9), netWorth: 15000, savings: 15000, investments: 0, totalDebt: 0 }}
        targetLabel="Oct 2026"
        targetPoint={{ date: U(2026, 10), netWorth: 20000, savings: 20000, investments: 0, totalDebt: 0 }}
      />
    );
    // "from $15,000.00" — the dot's figure, not the period close ($18,000).
    expect(screen.getAllByText("$15,000.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("$18,000.00")).toBeNull();
  });
});
