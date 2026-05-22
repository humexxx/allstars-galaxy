"use client";

import { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import type { Projection, ProjectionMonth } from "@/types/finance";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

type ProjectionTableProps = {
  projection: Projection;
  /** Limits the table to the first N months of the projection. When omitted
   *  the entire horizon is rendered. */
  monthsToShow?: number;
};

/** Keep months 1-12 + year-end milestones, identical to the chart densifier. */
function densify(months: ProjectionMonth[]): ProjectionMonth[] {
  if (months.length <= 24) return months;
  const kept: ProjectionMonth[] = [];
  for (let i = 0; i < months.length; i++) {
    if (i < 12 || (i + 1) % 12 === 0) kept.push(months[i]);
  }
  if (kept[kept.length - 1] !== months[months.length - 1]) {
    kept.push(months[months.length - 1]);
  }
  return kept;
}

export function ProjectionTable({ projection, monthsToShow }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleMonths = useMemo(() => {
    if (typeof monthsToShow !== "number") return projection.months;
    return projection.months.slice(0, Math.max(1, monthsToShow));
  }, [projection.months, monthsToShow]);

  const hasInvestments = visibleMonths.some((m) => m.investments > 0.01);
  const isLongHorizon = visibleMonths.length > 24;
  const rows = useMemo(
    () => (showAll || !isLongHorizon ? visibleMonths : densify(visibleMonths)),
    [visibleMonths, showAll, isLongHorizon]
  );

  return (
    <div className="space-y-2">
      {isLongHorizon && (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {showAll
              ? `Showing all ${visibleMonths.length} months`
              : `Showing the first 12 months + each year-end (${rows.length} of ${visibleMonths.length})`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Compact view" : "Show every month"}
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <div className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[80px]">Month</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Debt pmt</TableHead>
                <TableHead className="text-right">Extra pmt</TableHead>
                <TableHead className="text-right" title="Investment + savings interest earned minus debt interest accrued">
                  Net interest
                </TableHead>
                <TableHead className="text-right">Savings</TableHead>
                {hasInvestments && <TableHead className="text-right">Investments</TableHead>}
                <TableHead className="text-right">Total debt</TableHead>
                <TableHead className="text-right">Net worth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.monthOffset}>
                  <TableCell className="font-medium">
                    {MONTH_FORMATTER.format(m.date)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(m.income)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(m.expenses)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(m.scheduledDebtPayments)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      m.extraDebtPayments > 0 ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {m.extraDebtPayments > 0 ? formatCurrency(m.extraDebtPayments) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      // Net interest = what compounded into your favour minus what
                      // accrued against you. Positive (green) once investments earn
                      // more than debts cost; negative (red) when debts dominate.
                      const net =
                        m.investmentsInterest + m.savingsInterest - m.totalInterestAccrued;
                      if (Math.abs(net) < 0.005) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      const isPositive = net > 0;
                      return (
                        <span
                          className={isPositive ? "text-green-600" : "text-red-600"}
                          title={`Earned ${formatCurrency(m.investmentsInterest + m.savingsInterest)} · Paid ${formatCurrency(m.totalInterestAccrued)}`}
                        >
                          {isPositive ? "+" : "−"}
                          {formatCurrency(Math.abs(net))}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(m.savings)}</TableCell>
                  {hasInvestments && (
                    <TableCell className="text-right text-blue-600">
                      {formatCurrency(m.investments)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {formatCurrency(m.totalDebt)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      m.netWorth >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(m.netWorth)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
