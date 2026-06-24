"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency, formatSignedPercent, parseDecimal } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Mono, Text } from "@/components/ui/typography";
import { StatusBadge, TypeBadge } from "./transaction-badges";
import type { PortfolioTransaction } from "@/types/portfolio";

type TransactionsTableProps = {
  transactions: PortfolioTransaction[];
};

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        description="Add your first transaction to get started."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Investment Method</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Fee</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Initial Value</TableHead>
            <TableHead>Current Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const isBuy = transaction.type === "buy";
            const initial = parseDecimal(transaction.initialValue);
            const current = parseDecimal(transaction.currentValue);
            const growth = isBuy && initial > 0 ? ((current - initial) / initial) * 100 : null;

            return (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  <Mono>{format(new Date(transaction.date), "MMM d, yyyy")}</Mono>
                  <Mono as="div" className="text-xs text-muted-foreground">
                    {format(new Date(transaction.date), "h:mm a")}
                  </Mono>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-xs font-semibold text-primary">
                        {transaction.investmentMethod.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <Text as="span" className="font-medium">{transaction.investmentMethod.name}</Text>
                      <Text variant="small" as="span">
                        {transaction.investmentMethod.author}
                      </Text>
                    </div>
                  </div>
                </TableCell>
                <TableCell><TypeBadge type={transaction.type} /></TableCell>
                <TableCell><Mono>{formatCurrency(transaction.amount)}</Mono></TableCell>
                <TableCell><Mono>{formatCurrency(transaction.fee)}</Mono></TableCell>
                <TableCell className="font-semibold"><Mono>{formatCurrency(transaction.total)}</Mono></TableCell>
                <TableCell>
                  {isBuy && transaction.initialValue ? (
                    <Mono>{formatCurrency(transaction.initialValue)}</Mono>
                  ) : (
                    <Text variant="small" as="span">—</Text>
                  )}
                </TableCell>
                <TableCell>
                  {isBuy && transaction.currentValue && transaction.initialValue ? (
                    <div className="flex flex-col">
                      <Mono className="font-medium">{formatCurrency(transaction.currentValue)}</Mono>
                      {growth !== null && (
                        <Mono className={`text-xs ${growth >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatSignedPercent(growth)}
                        </Mono>
                      )}
                    </div>
                  ) : (
                    <Text variant="small" as="span">—</Text>
                  )}
                </TableCell>
                <TableCell><StatusBadge status={transaction.status} /></TableCell>
                <TableCell>
                  {transaction.notes ? (
                    <Text variant="muted" as="span">{transaction.notes}</Text>
                  ) : (
                    <Text variant="small" as="span">—</Text>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
