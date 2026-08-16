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
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export type InvestorSummaryRow = {
  investorId: string;
  name: string;
  movements: number;
  contributed: number;
  owed: number;
  positionValue: number;
  profitLoss: number;
};

/**
 * One row per investor: the relationship, not its transactions.
 *
 * Listing every movement made this a wall of rows in which the interesting
 * question — how is each person doing, and what does their promise cost — had
 * to be reconstructed by eye. The per-transaction history is a second question
 * and sits behind a button.
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

  const money = (v: number) => {
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Investor</TableHead>
            <TableHead className="text-right">Movements</TableHead>
            <TableHead className="text-right">Contributed</TableHead>
            <TableHead className="text-right">Worth now</TableHead>
            <TableHead className="text-right">You owe</TableHead>
            <TableHead className="text-right">Your margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.investorId}>
              <TableCell>
                <Text className="text-xs font-medium">{r.name}</Text>
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{r.movements}</Mono>
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{money(r.contributed)}</Mono>
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{money(r.positionValue)}</Mono>
                {r.contributed > 0 && (
                  <Mono
                    className={cn(
                      "block text-2xs tabular-nums",
                      statToneClass(
                        r.positionValue >= r.contributed ? "positive" : "negative"
                      )
                    )}
                  >
                    {(
                      ((r.positionValue - r.contributed) / r.contributed) *
                      100
                    ).toFixed(1)}
                    %
                  </Mono>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{money(r.owed)}</Mono>
              </TableCell>
              <TableCell className="text-right">
                <Mono
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    statToneClass(r.profitLoss >= 0 ? "positive" : "negative")
                  )}
                >
                  {money(r.profitLoss)}
                </Mono>
                {r.owed > 0 && (
                  <Mono
                    className={cn(
                      "block text-2xs tabular-nums",
                      statToneClass(r.profitLoss >= 0 ? "positive" : "negative")
                    )}
                  >
                    {r.profitLoss >= 0 ? "+" : ""}
                    {((r.profitLoss / r.owed) * 100).toFixed(1)}%
                  </Mono>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
