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
import { formatCurrency, formatSignedPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type InvestorSummaryRow = {
  investorId: string;
  name: string;
  movements: number;
  /** Cash in, net of withdrawals. */
  contributed: number;
  owed: number;
  positionValue: number;
  /** positionValue - owed: what their money earns you after the promise. */
  profitLoss: number;
};

/**
 * One row per investor: the relationship, not its transactions.
 *
 * Listing every movement made this a wall of rows in which the interesting
 * question — how is each person doing, and what does their promise cost — had
 * to be reconstructed by eye.
 *
 * Worth now and Owed are measured against the cash they put in (net of
 * withdrawals). The last column is the owner's MARGIN on that person — worth
 * now minus owed, as a share of what is owed, the same figure and base as the
 * Margin card. It used to be headed "P/L" beside a transactions table whose
 * P/L means something else (value against cost), so one heading carried two
 * quantities on one screen.
 */
export function InvestorSummaryTable({
  rows,
  hideValues = false,
}: {
  rows: InvestorSummaryRow[];
  hideValues?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No outside investors yet"
        description="People who invest in your methods will appear here."
      />
    );
  }

  const money = (v: number): string => {
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  const share = (value: number, base: number, tone: boolean) =>
    base > 0 && (
      <Mono
        className={cn(
          "block text-2xs tabular-nums",
          tone && statToneClass(value >= 0 ? "positive" : "negative")
        )}
      >
        {formatSignedPercent((value / base) * 100, 1)}
      </Mono>
    );

  const cells = (r: InvestorSummaryRow) => ({
    worth: (
      <>
        <Mono className="text-xs tabular-nums">{money(r.positionValue)}</Mono>
        {share(r.positionValue - r.contributed, r.contributed, true)}
      </>
    ),
    owed: (
      <>
        <Mono className="text-xs font-medium tabular-nums">{money(r.owed)}</Mono>
        {share(r.owed - r.contributed, r.contributed, true)}
      </>
    ),
    margin: (
      <>
        <Mono
          className={cn(
            "text-xs tabular-nums",
            statToneClass(r.profitLoss >= 0 ? "positive" : "negative")
          )}
        >
          {money(r.profitLoss)}
        </Mono>
        {share(r.profitLoss, r.owed, true)}
      </>
    ),
  });

  return (
    <div className="@container">
      {/* A list where six columns do not fit; the table where they do. */}
      <ul className="flex flex-col divide-y @2xl:hidden">
        {rows.map((r) => {
          const c = cells(r);
          return (
            <li key={r.investorId} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text
                    as="span"
                    variant="small"
                    weight="medium"
                    className="truncate text-foreground"
                  >
                    {r.name}
                  </Text>
                  <Text as="span" variant="small" className="text-2xs">
                    {r.movements} {r.movements === 1 ? "movement" : "movements"}
                  </Text>
                </div>
                <div className="shrink-0 text-right">
                  <Eyebrow as="div" size="sm">
                    Net in
                  </Eyebrow>
                  <Mono className="text-sm font-semibold tabular-nums">
                    {money(r.contributed)}
                  </Mono>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-x-3">
                {(
                  [
                    ["Worth now", c.worth, "text-left"],
                    ["Owed", c.owed, "text-center"],
                    ["Margin", c.margin, "text-right"],
                  ] as const
                ).map(([label, body, align]) => (
                  <div key={label} className={cn("flex flex-col gap-1", align)}>
                    <dt>
                      <Eyebrow as="span" size="sm">
                        {label}
                      </Eyebrow>
                    </dt>
                    <dd>{body}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>

      {/* `Table` already scrolls sideways; a wrapper of its own nested a second
          scroller inside the first. */}
      <div className="hidden @2xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead>Movements</TableHead>
              <TableHead className="text-right">Net in</TableHead>
              <TableHead className="text-right">Worth now</TableHead>
              <TableHead className="text-right">Owed</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const c = cells(r);
              return (
                <TableRow key={r.investorId}>
                  <TableCell>
                    <Text variant="small" weight="medium" className="text-foreground">
                      {r.name}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Mono className="text-xs tabular-nums">{r.movements}</Mono>
                  </TableCell>
                  <TableCell className="text-right">
                    <Mono className="text-xs font-semibold tabular-nums">
                      {money(r.contributed)}
                    </Mono>
                  </TableCell>
                  <TableCell className="text-right">{c.worth}</TableCell>
                  <TableCell className="text-right">{c.owed}</TableCell>
                  <TableCell className="text-right">{c.margin}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
