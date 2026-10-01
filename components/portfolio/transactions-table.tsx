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
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { maskValue, statToneClass } from "@/components/ui/stat-card";
import { useReaderTimeZone } from "@/components/reader-time-zone";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedPercent } from "@/lib/utils/format";
import { StatusBadge, TypeBadge } from "./transaction-badges";
import { formatUnits } from "./figures";
import type { TransactionTableRow } from "@/types/portfolio";
import { cn } from "@/lib/utils";

type Derived = {
  row: TransactionTableRow;
  /** The promised balance today, null when the row carries none. */
  owed: number | null;
  /** Growth of the promise, with withdrawals added back. */
  growth: number | null;
  /** Today's value of the units this row bought, null when unpriced. */
  value: number | null;
  pl: number | null;
  plShare: number | null;
};

function derive(r: TransactionTableRow): Derived {
  const owed =
    r.type === "buy" && r.currentValue !== null ? parseFloat(r.currentValue) : null;
  const initial = r.initialValue === null ? null : parseFloat(r.initialValue);
  // `currentValue` is net of anything withdrawn from this buy; without adding
  // that back a partial cash-out read as the investment losing money.
  const growth =
    owed !== null && initial !== null && initial > 0
      ? ((owed + (r.withdrawn ?? 0) - initial) / initial) * 100
      : null;

  // What the position this transaction created is worth today. A withdrawal
  // SOLD units: their value today is not something this row holds.
  const priced = r.allocations.filter((a) => a.price !== null);
  const complete = r.allocations.length > 0 && priced.length === r.allocations.length;
  const value =
    r.type === "buy" && complete
      ? priced.reduce((s, a) => s + a.quantity * (a.price ?? 0), 0)
      : null;
  const invested = r.allocations.reduce((s, a) => s + a.invested, 0);
  const pl = value === null ? null : value - invested;
  return {
    row: r,
    owed,
    growth,
    value,
    pl,
    plShare: pl !== null && invested > 0 ? (pl / invested) * 100 : null,
  };
}

export function TransactionsTable({
  rows,
  showInvestor = false,
  showStatus = false,
  showPositions = true,
  balanceLabel = "Owed",
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
  /** What each contribution bought (Bought / Worth now / P/L). Only for
   *  someone who runs the methods: for a client those columns would either
   *  leak the owner's private allocation or sit empty on every row. */
  showPositions?: boolean;
  /** "Owed" when the rows are other people's money; "Balance" for your own —
   *  you cannot owe yourself. */
  balanceLabel?: string;
  hideValues?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const timeZone = useReaderTimeZone();
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

  const derived = rows.map(derive);

  const bought = (r: TransactionTableRow) => {
    if (r.allocations.length === 0) {
      // Only an APPROVED contribution is ever priced; "not priced" on a
      // pending row read like a fault.
      return (
        <Text variant="small" className="text-2xs">
          {r.status === "approved" || r.status === "closed" ? "not priced yet" : "—"}
        </Text>
      );
    }
    return r.allocations.map((a) => (
      <div key={a.symbol} className="whitespace-nowrap">
        {/* Units times the price beside them IS the amount, so masked mode
            masks the units too; the price is public market data. */}
        <Mono className="text-xs tabular-nums">
          {hideValues ? maskValue(formatUnits(a.quantity)) : formatUnits(a.quantity)}{" "}
          {a.symbol}
        </Mono>
        <Mono className="block text-2xs text-muted-foreground tabular-nums">
          @ {formatCurrency(a.priceAtPurchase)}
        </Mono>
      </div>
    ));
  };

  const plCell = (d: Derived, align = "text-right") => (
    <div className={align}>
      <Mono
        className={cn(
          "text-xs tabular-nums",
          statToneClass(d.pl === null ? "neutral" : d.pl >= 0 ? "positive" : "negative")
        )}
      >
        {d.pl === null ? "—" : money(d.pl)}
      </Mono>
      {d.plShare !== null && (
        <Mono
          className={cn(
            "block text-2xs tabular-nums",
            statToneClass(d.plShare >= 0 ? "positive" : "negative")
          )}
        >
          {formatSignedPercent(d.plShare, 1)}
        </Mono>
      )}
    </div>
  );

  const owedCell = (d: Derived, align = "text-right") =>
    d.owed === null ? (
      <Text variant="small" className={cn("text-2xs", align)}>
        —
      </Text>
    ) : (
      <div className={align}>
        <Mono className="text-xs font-medium tabular-nums">{money(d.owed)}</Mono>
        {d.growth !== null && (
          <Mono
            className={cn(
              "block text-2xs tabular-nums",
              statToneClass(d.growth >= 0 ? "positive" : "negative")
            )}
          >
            {formatSignedPercent(d.growth, 1)}
          </Mono>
        )}
      </div>
    );

  return (
    // Sized by its container, not the viewport: the same table sits in a
    // full-width card on a phone and beside the sidebar on a tablet. Below
    // the width its columns need it becomes a list — a nine-column table
    // scrolled sideways inside a card hid every figure but the date.
    <div className="@container">
      <ul
        className={cn(
          "flex flex-col divide-y",
          showPositions ? "@3xl:hidden" : "@xl:hidden"
        )}
      >
        {derived.map((d) => {
          const r = d.row;
          return (
            <li key={r.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Text
                    as="span"
                    variant="small"
                    weight="medium"
                    className="truncate text-foreground"
                  >
                    {showInvestor && r.investorName ? `${r.investorName} · ` : ""}
                    {r.methodName}
                  </Text>
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="text-xs text-muted-foreground">
                      {formatDay(r.date, timeZone)}
                    </Mono>
                    <TypeBadge type={r.type} />
                    {showStatus && <StatusBadge status={r.status} />}
                  </div>
                </div>
                <Mono className="shrink-0 text-sm font-semibold tabular-nums">
                  {money(r.total)}
                </Mono>
              </div>

              {/* A pending or rejected row bought nothing and is owed nothing:
                  a block of dashes under it is noise. */}
              {(r.allocations.length > 0 || d.owed !== null) && (
                <dl
                  className={cn(
                    "grid gap-x-3 gap-y-2",
                    showPositions ? "grid-cols-3" : "grid-cols-1"
                  )}
                >
                  {showPositions && (
                    <>
                      <div className="col-span-3 flex flex-col gap-1">
                        <dt>
                          <Eyebrow as="span" size="sm">
                            {r.type === "withdrawal" ? "Sold" : "Bought"}
                          </Eyebrow>
                        </dt>
                        <dd className="flex flex-wrap gap-x-4 gap-y-1">{bought(r)}</dd>
                      </div>
                      <div className="flex flex-col gap-1">
                        <dt>
                          <Eyebrow as="span" size="sm">
                            Worth now
                          </Eyebrow>
                        </dt>
                        <dd>
                          <Mono className="text-xs tabular-nums">
                            {d.value === null ? "—" : money(d.value)}
                          </Mono>
                        </dd>
                      </div>
                      <div className="flex flex-col gap-1 text-center">
                        <dt>
                          <Eyebrow as="span" size="sm">
                            P/L
                          </Eyebrow>
                        </dt>
                        <dd>{plCell(d, "text-center")}</dd>
                      </div>
                    </>
                  )}
                  <div className={cn("flex flex-col gap-1", showPositions && "text-right")}>
                    <dt>
                      <Eyebrow as="span" size="sm">
                        {balanceLabel}
                      </Eyebrow>
                    </dt>
                    <dd>{owedCell(d, showPositions ? "text-right" : "text-left")}</dd>
                  </div>
                </dl>
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn("hidden", showPositions ? "@3xl:block" : "@xl:block")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showInvestor && <TableHead>Investor</TableHead>}
              <TableHead>Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {showPositions && (
                <>
                  <TableHead>Bought</TableHead>
                  <TableHead className="text-right">Worth now</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                </>
              )}
              <TableHead className="text-right">{balanceLabel}</TableHead>
              {showStatus && <TableHead>Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {derived.map((d) => {
              const r = d.row;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    {/* A timestamp: the server formats it in UTC, the browser in
                        the viewer's zone, and near midnight those are different days. */}
                    <Mono className="text-xs">
                      {formatDay(r.date, timeZone)}
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

                  {showPositions && (
                    <>
                      {/* The allocation as it stood that day: units at that day's price. */}
                      <TableCell>{bought(r)}</TableCell>

                      <TableCell className="text-right">
                        <Mono className="text-xs tabular-nums">
                          {d.value === null ? "—" : money(d.value)}
                        </Mono>
                      </TableCell>

                      <TableCell>{plCell(d)}</TableCell>
                    </>
                  )}

                  {/* What the stake is promised — fixed, and unrelated to P/L. */}
                  <TableCell>{owedCell(d)}</TableCell>

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
      </div>
    </div>
  );
}
