"use client";

import { useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Pencil, Scale, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteBalanceAdjustmentAction,
  deleteCashMovementAction,
  deleteTradeAction,
} from "@/app/actions/trading-journal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { positionLabel } from "@/lib/finance/trading";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedCurrency, formatSignedPercent, moneySign } from "@/lib/utils/format";
import type { JournalAdjustment, JournalCashMovement, JournalTrade } from "@/types/trading";

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

export type TradeFilter = "all" | "open" | "closed";

/** Which trades the list shows. */
export function TradeFilterControl({
  value,
  onChange,
}: {
  value: TradeFilter;
  onChange: (next: TradeFilter) => void;
}): React.ReactElement {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as TradeFilter)}
      aria-label="Show trades"
    >
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="open">Open</ToggleGroupItem>
      <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Every trade, open ones first. On a wide screen it fills the card and
 * scrolls inside it, under a pinned header.
 */
export function JournalTradesTable({
  trades,
  filter,
  onEdit,
  onClose,
}: {
  trades: readonly JournalTrade[];
  filter: TradeFilter;
  onEdit: (trade: JournalTrade) => void;
  onClose: (trade: JournalTrade) => void;
}): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const shown = [...trades]
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1));

  const remove = (trade: JournalTrade): void =>
    startTransition(async () => {
      const result = await deleteTradeAction(trade.id);
      if (result.success) toast.success(`${trade.symbol} deleted`);
      else toast.error(result.error);
    });

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="max-h-120 min-h-0 overflow-auto xl:max-h-none">
          <Table className="text-xs" containerClassName="overflow-visible">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead className="hidden sm:table-cell">Opened</TableHead>
                <TableHead className="hidden sm:table-cell">Closed</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No trades here yet.
                  </TableCell>
                </TableRow>
              )}
              {shown.map((t) => {
                const position = positionLabel(t);
                const opened = formatDay(t.openedDay).replace(/, \d{4}$/, "");
                const closed = t.closedDay ? formatDay(t.closedDay).replace(/, \d{4}$/, "") : null;
                return (
                  <TableRow key={t.id} className={cn(pending && "opacity-70")}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium">{t.symbol}</span>
                        {position && <span className="text-2xs text-muted-foreground">{position}</span>}
                        {/* A phone has no room for two date columns beside the result:
                            the dates ride under the instrument, and the P&L stays on screen. */}
                        <span className="font-mono text-2xs text-muted-foreground sm:hidden">
                          {opened}
                          {closed == null ? " · open" : t.closedDay === t.openedDay ? "" : ` → ${closed}`}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono sm:table-cell">{opened}</TableCell>
                    <TableCell className="hidden font-mono sm:table-cell">
                      {closed ? (
                        closed
                      ) : (
                        <Badge variant="outline" className="border-primary/50 text-primary">
                          Open
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.pnl == null ? (
                        <Button size="xs" variant="outline" onClick={() => onClose(t)}>
                          Close
                        </Button>
                      ) : (
                        <span className="flex flex-col items-end">
                          <Mono className={cn("font-semibold", toneText(t.pnl))}>{formatSignedCurrency(t.pnl)}</Mono>
                          {t.returnPct != null && (
                            <Mono className={cn("text-2xs", toneText(t.pnl))}>
                              {formatSignedPercent(t.returnPct * 100)}
                            </Mono>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
                      {t.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${t.symbol}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {t.status === "open" && (
                            <DropdownMenuItem onSelect={() => onClose(t)}>
                              <X />
                              Close trade
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => onEdit(t)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => remove(t)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </div>
    </div>
  );
}

type Movement =
  | { kind: "cash"; at: string; cash: JournalCashMovement }
  | { kind: "adjustment"; at: string; adjustment: JournalAdjustment };

/** What moved the balance besides the trades: deposits, withdrawals and balance adjustments, newest first. */
export function JournalCashCard({
  cash,
  adjustments,
}: {
  cash: readonly JournalCashMovement[];
  adjustments: readonly JournalAdjustment[];
}): React.ReactElement {
  const [, startTransition] = useTransition();
  const removeCash = (c: JournalCashMovement): void =>
    startTransition(async () => {
      const result = await deleteCashMovementAction(c.id);
      if (result.success) toast.success(c.kind === "deposit" ? "Deposit deleted" : "Withdrawal deleted");
      else toast.error(result.error);
    });
  const removeAdjustment = (a: JournalAdjustment): void =>
    startTransition(async () => {
      const result = await deleteBalanceAdjustmentAction(a.id);
      if (result.success) toast.success("Adjustment deleted");
      else toast.error(result.error);
    });

  const movements: Movement[] = [
    ...cash.map((c): Movement => ({ kind: "cash", at: c.occurredAt, cash: c })),
    ...adjustments.map((a): Movement => ({ kind: "adjustment", at: a.occurredAt, adjustment: a })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <Card className="gap-3 xl:min-h-0 xl:flex-1">
      <CardHeader>
        <Eyebrow size="sm" asChild>
          <h3>Deposits, withdrawals &amp; adjustments</h3>
        </Eyebrow>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 xl:min-h-0 xl:overflow-y-auto">
        {movements.length === 0 && <Text variant="small">No money moved yet.</Text>}
        {movements.map((m) =>
          m.kind === "cash" ? (
            <MovementRow
              key={m.cash.id}
              icon={
                m.cash.kind === "deposit" ? (
                  <ArrowDownLeft className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden />
                )
              }
              label={m.cash.kind === "deposit" ? "Deposit" : "Withdrawal"}
              day={m.cash.day}
              note={m.cash.note}
              amount={`${m.cash.kind === "deposit" ? "+" : "-"}${formatCurrency(m.cash.amount)}`}
              tone={m.cash.kind === "deposit" ? "text-success" : "text-destructive"}
              deleteLabel="Delete this movement"
              onDelete={() => removeCash(m.cash)}
            />
          ) : (
            <MovementRow
              key={m.adjustment.id}
              icon={<Scale className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              label="Balance adjustment"
              day={m.adjustment.day}
              note={m.adjustment.note}
              amount={formatSignedCurrency(m.adjustment.amount)}
              tone={toneText(m.adjustment.amount)}
              deleteLabel="Delete this adjustment"
              onDelete={() => removeAdjustment(m.adjustment)}
            />
          )
        )}
      </CardContent>
    </Card>
  );
}

function MovementRow({
  icon,
  label,
  day,
  note,
  amount,
  tone,
  deleteLabel,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  day: string;
  note: string | null;
  amount: string;
  tone: string;
  deleteLabel: string;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <div className="group flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">{label}</span>
          <span className="truncate text-2xs text-muted-foreground">
            {formatDay(day)}
            {note ? ` · ${note}` : ""}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-1">
        <Mono className={cn("text-sm", tone)}>{amount}</Mono>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={deleteLabel}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </span>
    </div>
  );
}
