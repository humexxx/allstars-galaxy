"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { maskValue } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";

export type InvestorTransactionRow = {
  id: string;
  date: string;
  methodName: string;
  investorName: string;
  type: string;
  status: string;
  total: string;
  currentValue: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
  closed: "outline",
};

/**
 * What other people have put into the methods this user runs.
 *
 * Separate from the owner's own history rather than merged into one list:
 * these are somebody else's movements against the owner's product, and mixing
 * them into a personal transaction log would make the running totals of both
 * meaningless.
 */
export function InvestorTransactionsTable({
  rows,
  hideValues = false,
}: {
  rows: InvestorTransactionRow[];
  hideValues?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No outside investors yet"
        description="Transactions other people make in your methods will appear here."
      />
    );
  }

  const money = (v: string | null) => {
    if (v === null) return "—";
    const formatted = formatCurrency(parseFloat(v));
    return hideValues ? maskValue(formatted) : formatted;
  };

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Worth now</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Mono className="text-xs tabular-nums">
                  {new Date(r.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </Mono>
              </TableCell>
              <TableCell>
                <Text className="text-xs font-medium">{r.investorName}</Text>
              </TableCell>
              <TableCell>
                <Text className="text-xs text-muted-foreground">{r.methodName}</Text>
              </TableCell>
              <TableCell>
                <Text className="text-xs capitalize">{r.type}</Text>
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{money(r.total)}</Mono>
              </TableCell>
              <TableCell className="text-right">
                <Mono className="text-xs tabular-nums">{money(r.currentValue)}</Mono>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-2xs">
                  {r.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
