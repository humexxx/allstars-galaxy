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
import { useReaderTimeZone } from "@/components/reader-time-zone";
import { formatDateTime, formatDay } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
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
  /** `row` inside the table; `card` for the stacked list a phone gets, where
   *  an eight-column table hid the amount and the approve buttons behind a
   *  sideways scroll. */
  layout?: "row" | "card";
}

type Decision = "approve" | "reject";

/**
 * Timestamps: the server renders them in UTC, the browser in the admin's own
 * zone, so the text legitimately differs between the two passes.
 */
function Timestamp({ value }: { value: Date }) {
  const timeZone = useReaderTimeZone();
  return (
    <Mono className="text-xs text-muted-foreground">
      <time dateTime={new Date(value).toISOString()}>
        {formatDateTime(value, timeZone)}
      </time>
    </Mono>
  );
}

/**
 * Who settled the row. An admin's own entry is approved as it is saved, with
 * no approver recorded — that is "auto-approved", not unprocessed; showing a
 * bare dash beside "Approved" read like missing data.
 */
function ProcessedBy({ transaction }: { transaction: AdminTransactionRow }) {
  if (transaction.rejectedAt) {
    return (
      <div className="flex min-w-0 flex-col">
        <Text as="span" variant="small" weight="medium" className="truncate text-destructive">
          {transaction.rejectedBy?.fullName || transaction.rejectedBy?.email || "Rejected"}
        </Text>
        <Timestamp value={transaction.rejectedAt} />
      </div>
    );
  }
  if (transaction.approvedAt) {
    return (
      <div className="flex min-w-0 flex-col">
        <Text as="span" variant="small" weight="medium" className="truncate text-success">
          {transaction.approvedBy
            ? transaction.approvedBy.fullName || transaction.approvedBy.email
            : "Auto-approved"}
        </Text>
        <Timestamp value={transaction.approvedAt} />
      </div>
    );
  }
  return (
    <Text as="span" variant="muted">
      <span aria-hidden>—</span>
      <span className="sr-only">Not processed</span>
    </Text>
  );
}

function Person({ transaction }: { transaction: AdminTransactionRow }) {
  if (!transaction.user) {
    return (
      <Text as="span" variant="muted">
        Unknown user
      </Text>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={transaction.user.avatarUrl || ""} />
        <AvatarFallback>
          {transaction.user.fullName?.charAt(0) || transaction.user.email?.charAt(0) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <Text as="span" weight="medium" className="truncate">
          {transaction.user.fullName || transaction.user.email || "Unknown"}
        </Text>
        {transaction.user.fullName && (
          <Mono className="truncate text-xs text-muted-foreground">
            {transaction.user.email}
          </Mono>
        )}
      </div>
    </div>
  );
}

/** Approve / reject, each behind its own confirm. */
function Decisions({
  transaction,
  labelled = false,
}: {
  transaction: AdminTransactionRow;
  /** Text beside the icons — on a phone an unlabelled ✓ and ✕ are a guess. */
  labelled?: boolean;
}) {
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

  // The method is the question an approver needs answered first: money into
  // which product, out of which one.
  const what = (
    <>
      <strong>{amount}</strong> {transaction.type}
      {transaction.method && (
        <>
          {transaction.type === "withdrawal" ? " from " : " into "}
          <strong>{transaction.method.name}</strong>
        </>
      )}
    </>
  );
  const who = (
    <>
      <strong className="break-words">{userDisplayName}</strong>
      {transaction.user?.email && transaction.user?.fullName && (
        <span className="break-all"> ({transaction.user.email})</span>
      )}
    </>
  );

  return (
    <div className="flex items-center justify-end gap-2">
      <AlertDialog {...dialogProps("approve")}>
        <AlertDialogTrigger asChild>
          <Button
            size={labelled ? "sm" : "icon-sm"}
            variant={labelled ? "outline" : "ghost"}
            className="text-success"
            aria-label={`Approve ${amount} ${transaction.type} for ${userDisplayName}`}
            disabled={isPending}
          >
            <Check />
            {labelled && "Approve"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Approve this {what} for {who}?
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
            size={labelled ? "sm" : "icon-sm"}
            variant={labelled ? "outline" : "ghost"}
            className="text-destructive"
            aria-label={`Reject ${amount} ${transaction.type} for ${userDisplayName}`}
            disabled={isPending}
          >
            <X />
            {labelled && "Reject"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Reject this {what} for {who}? This action cannot be undone.
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
  );
}

export function TransactionRow({ transaction, layout = "row" }: TransactionRowProps) {
  const timeZone = useReaderTimeZone();
  const amount = formatCurrency(transaction.amount);
  const pending = transaction.status === "pending";

  if (layout === "card") {
    return (
      <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
        <div className="flex items-start justify-between gap-3">
          <Person transaction={transaction} />
          <Mono className="shrink-0 text-sm font-semibold">{amount}</Mono>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={transaction.type} />
          <StatusBadge status={transaction.status} />
          <Text as="span" variant="small" className="min-w-0 truncate">
            {transaction.method?.name ?? "Unknown method"} ·{" "}
            <span>{formatDay(transaction.date, timeZone)}</span>
          </Text>
        </div>
        {pending ? (
          <Decisions transaction={transaction} labelled />
        ) : (
          <ProcessedBy transaction={transaction} />
        )}
      </li>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <Mono className="text-xs">
          {formatDay(transaction.date, timeZone)}
        </Mono>
      </TableCell>
      <TableCell className="max-w-56">
        <Person transaction={transaction} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <TypeBadge type={transaction.type} />
          <Text
            as="span"
            variant="small"
            className={cn("block max-w-36 truncate", !transaction.method && "italic")}
          >
            {transaction.method?.name ?? "Unknown method"}
          </Text>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Mono className="font-medium">{amount}</Mono>
      </TableCell>
      <TableCell>
        <StatusBadge status={transaction.status} />
      </TableCell>
      <TableCell className="max-w-48">
        <ProcessedBy transaction={transaction} />
      </TableCell>
      <TableCell className="text-right">
        {pending && <Decisions transaction={transaction} />}
      </TableCell>
    </TableRow>
  );
}
