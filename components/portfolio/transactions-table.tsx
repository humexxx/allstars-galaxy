"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Mono, Text } from "@/components/ui/typography";
import { maskValue, statToneClass } from "@/components/ui/stat-card";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedPercent } from "@/lib/utils/format";
import { StatusBadge, TypeBadge } from "./transaction-badges";
import type { TransactionTableRow } from "@/types/portfolio";
import { cn } from "@/lib/utils";

const UNITS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function TransactionsTable({
  rows,
  showInvestor = false,
  showStatus = false,
  hideValues = false,
  emptyTitle = "No transactions yet",
  emptyDescription = "Add your first transaction to get started.",
}: {
  rows: TransactionTableRow[];
  /** Adds the Investor column — only meaningful for other people's rows. */
  showInvestor?: boolean;
  /** Off by default: the list is filtered to approved rows, so a column
   *  reading "approved" on every line is a column of noise. It comes back
   *  with the detailed view, where the other statuses do too. */
  showStatus?: boolean;
  hideValues?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const money = (v: number | string | null | undefined): string => {
    if (v === null || v === undefined) return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!Number.isFinite(n)) return "—";
    const formatted = formatCurrency(n);
    return hideValues ? maskValue(formatted) : formatted;
  };

  return (
    // No frame and no scroller of its own: this table always sits inside a
    // Card, and `Table` already scrolls sideways.
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {showInvestor && <TableHead>Investor</TableHead>}
          <TableHead>Method</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Bought</TableHead>
          <TableHead className="text-right">Worth now</TableHead>
          <TableHead className="text-right">P/L</TableHead>
          <TableHead className="text-right">Owed</TableHead>
          {showStatus && <TableHead>Status</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const owed = r.currentValue === null ? null : parseFloat(r.currentValue);
          const initial = r.initialValue === null ? null : parseFloat(r.initialValue);
          const growth =
            owed !== null && initial !== null && initial > 0
              ? ((owed - initial) / initial) * 100
              : null;

          // What the position this transaction created is worth today.
          const priced = r.allocations.filter((a) => a.price !== null);
          const value = priced.reduce((s, a) => s + a.quantity * (a.price ?? 0), 0);
          const invested = r.allocations.reduce((s, a) => s + a.invested, 0);
          const pl =
            r.allocations.length > 0 && priced.length === r.allocations.length
              ? value - invested
              : null;

          return (
            <TableRow key={r.id}>
              <TableCell>
                {/* A timestamp: the server formats it in UTC, the browser in
                    the viewer's zone, and near midnight those are different days. */}
                <Mono className="text-xs" suppressHydrationWarning>
                  {formatDay(r.date)}
                </Mono>
              </TableCell>

              {showInvestor && (
                <TableCell>
                  <Text variant="small" weight="medium" className="text-foreground">
                    {r.investorName ?? "—"}
                  </Text>
                </TableCell>
              )}

              <TableCell>
                <Text
                  as="span"
                  variant="small"
                  weight="medium"
                  className="block max-w-40 truncate text-foreground"
                >
                  {r.methodName}
                </Text>
              </TableCell>

              <TableCell>
                <TypeBadge type={r.type} />
              </TableCell>

              <TableCell className="text-right">
                <Mono className="text-xs font-semibold tabular-nums">{money(r.total)}</Mono>
              </TableCell>

              {/* The allocation as it stood that day: units at that day's price. */}
              <TableCell>
                {r.allocations.length === 0 ? (
                  <Text variant="small" className="text-2xs">
                    not priced
                  </Text>
                ) : (
                  r.allocations.map((a) => (
                    <div key={a.symbol} className="whitespace-nowrap">
                      <Mono className="text-xs tabular-nums">
                        {UNITS.format(a.quantity)} {a.symbol}
                      </Mono>
                      <Mono className="block text-2xs text-muted-foreground tabular-nums">
                        @ {formatCurrency(a.priceAtPurchase)}
                      </Mono>
                    </div>
                  ))
                )}
              </TableCell>

              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">
                  {r.allocations.length === 0 || priced.length === 0 ? "—" : money(value)}
                </Mono>
              </TableCell>

              <TableCell className="text-right">
                <Mono
                  className={cn(
                    "text-xs tabular-nums",
                    statToneClass(pl === null ? "neutral" : pl >= 0 ? "positive" : "negative")
                  )}
                >
                  {pl === null ? "—" : money(pl)}
                </Mono>
                {pl !== null && invested > 0 && (
                  <Mono
                    className={cn(
                      "block text-2xs tabular-nums",
                      statToneClass(pl >= 0 ? "positive" : "negative")
                    )}
                  >
                    {formatSignedPercent((pl / invested) * 100, 1)}
                  </Mono>
                )}
              </TableCell>

              {/* What the investor is promised — fixed, and unrelated to P/L. */}
              <TableCell className="text-right">
                {owed === null ? (
                  <Text variant="small" className="text-2xs">
                    —
                  </Text>
                ) : (
                  <>
                    <Mono className="text-xs font-medium tabular-nums">{money(owed)}</Mono>
                    {growth !== null && (
                      <Mono
                        className={cn(
                          "block text-2xs tabular-nums",
                          statToneClass(growth >= 0 ? "positive" : "negative")
                        )}
                      >
                        {formatSignedPercent(growth, 1)}
                      </Mono>
                    )}
                  </>
                )}
              </TableCell>

              {showStatus && (
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
