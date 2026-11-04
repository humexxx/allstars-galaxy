import type { DashboardParts } from "@/lib/finance/dashboard";
import { moneySign } from "@/lib/utils/format";

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
 * orange it had as a loss. Owed to you and Debt only appear in the rail when
 * they are not zero. The rail draws its swatches from here, which makes it the chart's
 * legend. Outside the chart's "use client" module because the card is a
 * server component and would only get a client reference to it.
 *
 * Categorical slots in order (see "Chart colours" in CLAUDE.md). Net worth is
 * the total drawn over the parts, not one of them, so it takes the foreground.
 */
export const DASHBOARD_SERIES: readonly DashboardSeries[] = [
  { key: "netWorth", label: "Net worth", color: "var(--foreground)", mark: "line" },
  { key: "investments", label: "Portfolio", color: "var(--chart-1)", mark: "area" },
  // Cash is neutral, not a hue: the orange slot sat next to Debt and read as
  // money lost. Debt takes the destructive red — a sign, not an identity.
  { key: "savings", label: "Cash", color: "var(--muted-foreground)", mark: "area" },
  { key: "receivables", label: "Owed to you", color: "var(--chart-3)", mark: "area" },
  { key: "debt", label: "Debt", color: "var(--destructive)", mark: "area" },
];

export function dashboardSeries(key: keyof DashboardParts): DashboardSeries {
  const series = DASHBOARD_SERIES.find((s) => s.key === key);
  if (!series) throw new Error(`No dashboard series "${key}"`);
  return series;
}

/** Parts that show only when they are not zero somewhere in the range. */
const ONLY_WHEN_PRESENT: ReadonlySet<keyof DashboardParts> = new Set(["receivables", "debt"]);

/**
 * Which series the rail and the tooltip list for this range. Net worth,
 * Portfolio and Cash always; Owed to you and Debt when any point has some —
 * then at every point, $0 included, so a debt being paid off reads as
 * reaching zero instead of vanishing from the tooltip.
 */
export function visibleSeriesKeys(points: readonly DashboardParts[]): Set<keyof DashboardParts> {
  return new Set(
    DASHBOARD_SERIES.filter(
      (s) => !ONLY_WHEN_PRESENT.has(s.key) || points.some((p) => moneySign(p[s.key]) > 0)
    ).map((s) => s.key)
  );
}
