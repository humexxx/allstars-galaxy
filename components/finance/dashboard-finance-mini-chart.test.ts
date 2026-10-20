import { describe, expect, it } from "vitest";

import type { DashboardPoint } from "@/lib/finance/dashboard";

import { toRows } from "./dashboard-finance-mini-chart";

const point = (month: string, netWorth: number): DashboardPoint => ({
  month,
  label: month,
  savings: -50,
  investments: 300,
  receivables: 0,
  debt: 100,
  netWorth,
});

describe("toRows", () => {
  const rows = toRows([point("Aug", 1), point("Now", 2), point("Oct", 3)], 1);

  it("draws the past solid up to today and the projection from it", () => {
    // Today sits on both halves, so the solid line and the dashed one meet.
    expect(rows.map((r) => r.netWorthPast)).toEqual([1, 2, null]);
    expect(rows.map((r) => r.netWorthAhead)).toEqual([null, 2, 3]);
  });

  it("splits each stacked part the same way, overdraft with the debts", () => {
    expect(rows.map((r) => r.investmentsAhead)).toEqual([null, 300, 300]);
    expect(rows.map((r) => r.savingsBelowPast)).toEqual([-50, -50, null]);
    expect(rows.map((r) => r.savingsAbovePast)).toEqual([0, 0, null]);
    expect(rows.map((r) => r.debtBelowAhead)).toEqual([null, -100, -100]);
  });

  it("marks only the months after today as projected", () => {
    expect(rows.map((r) => r.projected)).toEqual([false, false, true]);
  });

  it("projects everything after the first point when there is no past", () => {
    const [start, next] = toRows([point("Start", 1), point("Jan", 2)], 0);
    expect([start.netWorthPast, next.netWorthPast]).toEqual([1, null]);
    expect([start.projected, next.projected]).toEqual([false, true]);
  });
});
