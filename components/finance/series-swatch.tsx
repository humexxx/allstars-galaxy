import { cn } from "@/lib/utils";

import type { DashboardSeries } from "./dashboard-finance-series";

/**
 * A finance series' key, drawn the way its chart draws it: a short dash for
 * a line, a small square for an area. Beside a figure it is that figure's
 * legend, so the colours mean the same on the dashboard and on a plan.
 */
export function SeriesSwatch({ series }: { series: DashboardSeries }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn("shrink-0", series.mark === "line" ? "h-0.5 w-2.5 rounded-full" : "size-2 rounded-xs")}
      style={{ backgroundColor: series.color }}
    />
  );
}
