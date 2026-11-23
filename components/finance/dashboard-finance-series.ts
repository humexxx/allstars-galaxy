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
 * them. Portfolio takes the first slot, the brand cyan: the owner read the
 * orange it had as a loss. A part appears in the rail only when the chart
 * draws it (`chartParts`): money somewhere in the chart's range. The rail
 * draws its swatches from here, which makes it the chart's legend. Outside the chart's "use client" module because the card is a
 * server component and would only get a client reference to it.
 *
 * Categorical slots in order (see "Chart colours" in CLAUDE.md). Net worth is
 * the total drawn over the parts, not one of them, so it is a line.
 */
export const DASHBOARD_SERIES: readonly DashboardSeries[] = [
  { key: "netWorth", label: "Net worth", color: "var(--success)", mark: "line" },
  { key: "investments", label: "Portfolio", color: "var(--chart-1)", mark: "area" },
  // The trading journal: the next categorical slot, as the plan chart draws it.
  { key: "trading", label: "Trading", color: "var(--chart-2)", mark: "area" },
  // Cash is the plan table's and chart's (white, the neutral foreground); the
  // dashboard card no longer draws or lists it, as the plan page's chart
  // doesn't. The orange slot beside Debt read as money lost.
  { key: "savings", label: "Cash", color: "var(--foreground)", mark: "area" },
  { key: "receivables", label: "Owed to you", color: "var(--chart-3)", mark: "area" },
  { key: "debt", label: "Debt", color: "var(--destructive)", mark: "area" },
];

export function dashboardSeries(key: keyof DashboardParts): DashboardSeries {
  const series = DASHBOARD_SERIES.find((s) => s.key === key);
  if (!series) throw new Error(`No dashboard series "${key}"`);
  return series;
}
