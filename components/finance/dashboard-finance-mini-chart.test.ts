import { describe, expect, it } from "vitest";

import type { DashboardPoint } from "@/lib/finance/dashboard";

import { toRows } from "./dashboard-finance-mini-chart";
import { visibleSeriesKeys } from "./dashboard-finance-series";

const point = (month: string, netWorth: number): DashboardPoint => ({
  time: netWorth,
  tick: true,
  kind: "close",
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

  it("splits each stacked part the same way, and never draws cash under zero", () => {
    expect(rows.map((r) => r.investmentsAhead)).toEqual([null, 300, 300]);
    expect(rows.map((r) => r.savingsBelowPast)).toEqual([0, 0, null]);
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

describe("visibleSeriesKeys", () => {
  const parts = (debt: number, receivables = 0) => ({
    savings: 0, investments: 0, receivables, debt, netWorth: receivables - debt,
  });

  it("always lists net worth, portfolio and cash; never debt nobody has", () => {
    expect([...visibleSeriesKeys([parts(0), parts(0)])]).toEqual(["netWorth", "investments", "savings"]);
  });

  it("keeps debt for the whole range once any point has some, its $0 months included", () => {
    const keys = visibleSeriesKeys([parts(500), parts(0), parts(0)]);
    expect(keys.has("debt")).toBe(true);
    expect(keys.has("receivables")).toBe(false);
  });
});

describe("toRows: a paid-off debt", () => {
  const at = (month: string, debt: number): DashboardPoint => ({
    ...point(month, 0),
    debt,
    savings: 0,
  });

  it("comes down to zero where it is paid off and is not drawn after", () => {
    const rows = toRows([at("Now", 300), at("Dec", 100), at("Jan", 0), at("Feb", 0), at("Mar", 0)], 0);
    expect(rows.map((r) => r.debtBelowAhead)).toEqual([-300, -100, 0, null, null]);
  });
});
