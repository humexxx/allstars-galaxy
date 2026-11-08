"use client";

import { useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Mono } from "@/components/ui/typography";
import { shownCash } from "@/lib/finance/cash";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  moneySign,
} from "@/lib/utils/format";
import { formatProjectionMonth } from "@/lib/utils/date";
import { sampleRows } from "@/lib/finance/table-rows";
import type { Projection } from "@/types/finance";

import { dashboardSeries, type DashboardSeries } from "./dashboard-finance-series";
import { SeriesSwatch } from "./series-swatch";

/** A column heading keyed with its chart series, as the dashboard keys its figures. */
function SeriesHead({ series, children }: { series: DashboardSeries; children: React.ReactNode }): React.ReactElement {
  return (
    <TableHead className="text-right">
      <span className="inline-flex items-center gap-1.5">
        <SeriesSwatch series={series} />
        {children}
      </span>
    </TableHead>
  );
}


type ProjectionTableProps = {
  projection: Projection;
  /** Limits the table to N months of the projection. When omitted the
   *  entire horizon (from `startIndex`) is rendered. */
  monthsToShow?: number;
  /** Index of the first row to show — the forecast window's start. */
  startIndex?: number;
  /** Projection row of the period that contains today, highlighted. */
  currentIndex?: number;
  /** Months between the rows from today's period on (see `rowStepFor`). */
  rowStep?: number;
};

/**
 * How far a figure moved since the row before, as a share of where it was:
 * the small line under the figures that matter. Null with nothing to compare
 * against, or from zero.
 */
function changeOf(value: number, previous: number | undefined): number | null {
  if (previous === undefined || Math.abs(previous) < 0.01) return null;
  return ((value - previous) / Math.abs(previous)) * 100;
}

function Change({
  pct,
  goodWhen = "up",
}: {
  pct: number | null;
  goodWhen?: "up" | "down";
}): React.ReactElement | null {
  if (pct === null || Math.abs(pct) < 0.05) return null;
  const good = goodWhen === "up" ? pct > 0 : pct < 0;
  return (
    <Mono className={cn("block text-2xs font-normal", good ? "text-success" : "text-destructive")}>
      {formatSignedPercent(pct, 1)}
    </Mono>
  );
}

export function ProjectionTable({
  projection,
  monthsToShow,
  startIndex = 0,
  currentIndex,
  rowStep = 1,
}: ProjectionTableProps) {

  // The rows are the chart's horizon (the editor works out the window): the
  // horizon picker above is the table's only control, so there is no "Load
  // more" any more.
  const first = Math.max(0, Math.min(startIndex, projection.months.length - 1));
  const totalAvailable = projection.months.length - first;
  const effectiveCount =
    typeof monthsToShow === "number"
      ? Math.max(1, Math.min(monthsToShow, totalAvailable))
      : totalAvailable;

  const visibleMonths = useMemo(
    () => projection.months.slice(first, first + effectiveCount),
    [projection.months, first, effectiveCount]
  );

  const hasInvestments = visibleMonths.some((m) => m.investments > 0.01);
  // Long horizons list a row every few months; the % lines then read the
  // change since the row above.
  const rows = useMemo(
    () => sampleRows(visibleMonths, (currentIndex ?? first) - first, rowStep),
    [visibleMonths, currentIndex, first, rowStep]
  );

  return (
    // Fills the panel on desktop and scrolls inside it; the rounded box clips
    // the sticky header, which used to paint over its corners.
    <div className="flex flex-col gap-2 xl:h-full xl:min-h-0">
      {/* As tall as its rows, never taller than the panel: a short horizon
          ends where its last row does instead of an empty bordered box. */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
        <div className="max-h-120 min-h-0 overflow-auto xl:max-h-none">
          {/* Two steps down from the primitive's text-sm: this table is a dense
              wall of currency, and the change lines under net worth, debt and
              investments need the room. */}
          {/* The box above scrolls both ways, so the header and the month
              column stay pinned to it. */}
          <Table className="text-2xs" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow>
                {/* Sticky: on a phone the table scrolls sideways, and without
                    the month every figure past the first columns was
                    anonymous. */}
                <TableHead className="sticky left-0 z-10 w-20 bg-card">
                  {/* The current period's row is its projected CLOSE; the
                      header's Today figure is the position on today, so the
                      two differ by design. Said here, where they meet. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Month
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Each row is where the period closes. Today&apos;s position is the
                      Today figure above.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Debt pmt
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Scheduled minimums plus any extra paid from the surplus
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        tabIndex={0}
                        className="cursor-help rounded-sm underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Net interest
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Investment + savings interest earned minus debt interest accrued
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <SeriesHead series={dashboardSeries("savings")}>Cash</SeriesHead>
                {hasInvestments && <SeriesHead series={dashboardSeries("investments")}>Investments</SeriesHead>}
                <SeriesHead series={dashboardSeries("debt")}>Total debt</SeriesHead>
                <SeriesHead series={dashboardSeries("netWorth")}>Net worth</SeriesHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m, i) => {
                // The row before, for the change lines: the previous row
                // shown, or the period before the window for the first.
                const prev = i > 0 ? rows[i - 1] : projection.months[first - 1];
                return (
                <TableRow
                  key={m.monthOffset}
                  data-month-offset={m.monthOffset}
                  aria-current={m.monthOffset === currentIndex ? "date" : undefined}
                  className={cn(m.monthOffset === currentIndex && "bg-muted")}
                >
                  <TableCell
                    className={cn(
                      "sticky left-0 z-10 font-medium",
                      m.monthOffset === currentIndex ? "bg-muted" : "bg-card"
                    )}
                  >
                    <Mono>{formatProjectionMonth(m.date)}</Mono>
                    {m.monthOffset === currentIndex && (
                      <span className="sr-only"> (current period, projected close)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Mono>{formatCurrency(m.income)}</Mono>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Mono>{formatCurrency(m.expenses)}</Mono>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {/* Minimums AND extra, so income − expenses − debt pmt −
                        invested + interest reconciles to the savings column. */}
                    <Mono>{formatCurrency(m.debtPayments)}</Mono>
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      // Net interest = what compounded into your favour minus what
                      // accrued against you. Positive (green) once investments earn
                      // more than debts cost; negative (red) when debts dominate.
                      const net =
                        m.investmentsInterest + m.savingsInterest - m.totalInterestAccrued;
                      if (moneySign(net) === 0) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      const isPositive = net > 0;
                      const detail = `Earned ${formatCurrency(m.investmentsInterest + m.savingsInterest)} · Paid ${formatCurrency(m.totalInterestAccrued)}`;
                      // Pointer-only tooltip: a tab stop per row would bury the
                      // table. The same detail is in the sr-only text.
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Mono
                              className={isPositive ? "text-success" : "text-destructive"}
                            >
                              {formatSignedCurrency(net)}
                              <span className="sr-only"> ({detail})</span>
                            </Mono>
                          </TooltipTrigger>
                          <TooltipContent>{detail}</TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(shownCash(m.savings))}
                  </TableCell>
                  {hasInvestments && (
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(m.investments)}
                      <Change pct={changeOf(m.investments, prev?.investments)} />
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(m.totalDebt)}
                    <Change pct={changeOf(m.totalDebt, prev?.totalDebt)} goodWhen="down" />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold tabular-nums",
                      moneySign(m.netWorth) < 0 && "text-destructive"
                    )}
                  >
                    {formatCurrency(m.netWorth)}
                    <Change pct={changeOf(m.netWorth, prev?.netWorth)} />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
