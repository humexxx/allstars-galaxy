import type { DashboardParts } from "@/lib/finance/dashboard";

export type DashboardSeries = {
  key: keyof DashboardParts;
  label: string;
  color: string;
  /** How the chart draws it, so the rail's swatch can say so. */
  mark: "line" | "area";
};

/**
 * The dashboard chart's series, in the order the card's figure rail lists
 * them. The rail draws its swatches from here, which makes it the chart's
 * legend. Outside the chart's "use client" module because the card is a
 * server component and would only get a client reference to it.
 *
 * Categorical slots in order (see "Chart colours" in CLAUDE.md). Net worth is
 * the total drawn over the parts, not one of them, so it takes the foreground.
 */
export const DASHBOARD_SERIES: readonly DashboardSeries[] = [
  { key: "netWorth", label: "Net worth", color: "var(--foreground)", mark: "line" },
  { key: "savings", label: "Savings", color: "var(--chart-1)", mark: "area" },
  { key: "investments", label: "Investments", color: "var(--chart-2)", mark: "area" },
  { key: "receivables", label: "Owed to you", color: "var(--chart-3)", mark: "area" },
  { key: "debt", label: "Debt", color: "var(--chart-4)", mark: "area" },
];

export function dashboardSeries(key: keyof DashboardParts): DashboardSeries {
  const series = DASHBOARD_SERIES.find((s) => s.key === key);
  if (!series) throw new Error(`No dashboard series "${key}"`);
  return series;
}
