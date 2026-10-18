"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Mono, Text } from "@/components/ui/typography";
import { StatusBadge, TypeBadge } from "@/components/portfolio/transaction-badges";
import { approveTransaction, rejectTransaction } from "@/app/actions/admin-transactions";
import { runAction } from "@/lib/actions/run";
import { formatDateTime, formatDay } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/format";
import type { AdminTransactionRow } from "@/types/transaction";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TransactionRowProps {
  transaction: AdminTransactionRow;
}

type Decision = "approve" | "reject";

/**
 * Timestamps: the server renders them in UTC, the browser in the admin's own
 * zone, so the text legitimately differs between the two passes.
 */
function Timestamp({ value }: { value: Date }) {
  return (
    <Mono className="text-xs text-muted-foreground">
      <time dateTime={new Date(value).toISOString()} suppressHydrationWarning>
        {formatDateTime(value)}
      </time>
    </Mono>
  );
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const [isPending, startTransition] = useTransition();
  const [openDialog, setOpenDialog] = useState<Decision | null>(null);

  const amount = formatCurrency(transaction.amount);
  const userDisplayName =
    transaction.user?.fullName || transaction.user?.email || "this user";

  const decide = (decision: Decision): void => {
    startTransition(async () => {
      const result = await runAction(
        decision === "approve"
          ? approveTransaction(transaction.id)
          : rejectTransaction(transaction.id),
        decision === "approve"
          ? { success: "Transaction approved", failure: "Failed to approve transaction" }
          : { success: "Transaction rejected", failure: "Failed to reject transaction" }
      );
      if (result.ok) setOpenDialog(null);
    });
  };

  // Radix closes an AlertDialog on Action click; holding it open until the
  // action settles is what lets the pending label and any failure show.
  const confirm =
    (decision: Decision) =>
    (e: MouseEvent): void => {
      e.preventDefault();
      decide(decision);
    };

  const dialogProps = (decision: Decision) => ({
    open: openDialog === decision,
    onOpenChange: (open: boolean) => {
      if (isPending) return;
      setOpenDialog(open ? decision : null);
    },
  });

  const who = (
    <>
      <strong>{userDisplayName}</strong>
      {transaction.user?.email && transaction.user?.fullName && ` (${transaction.user.email})`}
    </>
  );

  return (
    <TableRow>
      <TableCell>
        <Mono suppressHydrationWarning>{formatDay(transaction.date)}</Mono>
      </TableCell>
      <TableCell>
        {transaction.user ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={transaction.user.avatarUrl || ""} />
              <AvatarFallback>
                {transaction.user.fullName?.charAt(0) ||
                  transaction.user.email?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <Text as="span" weight="medium">
                {transaction.user.fullName || "Unknown"}
              </Text>
              <Mono className="max-w-48 truncate text-xs text-muted-foreground">
                {transaction.user.email}
              </Mono>
            </div>
          </div>
        ) : (
          <Text as="span" variant="muted">
            Unknown user
          </Text>
        )}
      </TableCell>
      <TableCell>
        <TypeBadge type={transaction.type} />
      </TableCell>
      <TableCell>
        <Mono className="font-medium">{amount}</Mono>
      </TableCell>
      <TableCell>
        <StatusBadge status={transaction.status} />
      </TableCell>
      <TableCell>
        {transaction.approvedBy && transaction.approvedAt && (
          <div className="flex flex-col">
            <Text as="span" weight="medium" className="text-success">
              {transaction.approvedBy.fullName || transaction.approvedBy.email}
            </Text>
            <Timestamp value={transaction.approvedAt} />
          </div>
        )}
        {transaction.rejectedBy && transaction.rejectedAt && (
          <div className="flex flex-col">
            <Text as="span" weight="medium" className="text-destructive">
              {transaction.rejectedBy.fullName || transaction.rejectedBy.email}
            </Text>
            <Timestamp value={transaction.rejectedAt} />
          </div>
        )}
        {!transaction.approvedBy && !transaction.rejectedBy && (
          <Text as="span" variant="muted">
            <span aria-hidden>—</span>
            <span className="sr-only">Not processed</span>
          </Text>
        )}
      </TableCell>
      <TableCell className="text-right">
        {transaction.status === "pending" && (
          <div className="flex items-center justify-end gap-2">
            <AlertDialog {...dialogProps("approve")}>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-success"
                  aria-label={`Approve ${amount} ${transaction.type} for ${userDisplayName}`}
                  disabled={isPending}
                >
                  <Check />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve transaction</AlertDialogTitle>
                  <AlertDialogDescription>
                    Approve this <strong>{amount}</strong> {transaction.type} transaction
                    for {who}?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirm("approve")} disabled={isPending}>
                    {isPending && <Spinner />}
                    {isPending ? "Approving…" : "Approve"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog {...dialogProps("reject")}>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`Reject ${amount} ${transaction.type} for ${userDisplayName}`}
                  disabled={isPending}
                >
                  <X />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject transaction</AlertDialogTitle>
                  <AlertDialogDescription>
                    Reject this <strong>{amount}</strong> {transaction.type} transaction
                    for {who}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={confirm("reject")}
                    disabled={isPending}
                  >
                    {isPending && <Spinner />}
                    {isPending ? "Rejecting…" : "Reject"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
