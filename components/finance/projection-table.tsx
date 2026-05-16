"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/format";
import type { Projection } from "@/types/finance";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
});

type ProjectionTableProps = {
  projection: Projection;
};

export function ProjectionTable({ projection }: ProjectionTableProps) {
  return (
    <div className="rounded-md border">
      <div className="max-h-[480px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-[80px]">Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Debt pmts</TableHead>
              <TableHead className="text-right">Cash flow</TableHead>
              <TableHead className="text-right">Savings</TableHead>
              <TableHead className="text-right">Total debt</TableHead>
              <TableHead className="text-right">Net worth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projection.months.map((m) => (
              <TableRow key={m.monthOffset}>
                <TableCell className="font-medium">
                  {MONTH_FORMATTER.format(m.date)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(m.income)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(m.expenses)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(m.debtPayments)}
                </TableCell>
                <TableCell
                  className={`text-right ${
                    m.cashFlow >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(m.cashFlow)}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(m.savings)}</TableCell>
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
  );
}
