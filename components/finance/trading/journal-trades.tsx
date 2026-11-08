"use client";

import { useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteCashMovementAction, deleteTradeAction } from "@/app/actions/trading-journal";
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
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalCashMovement, JournalTrade } from "@/types/trading";

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

const price = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });

type Filter = "all" | "open" | "closed";

/** Every trade, open ones first, and the account's deposits and withdrawals. */
export function JournalTrades({
  trades,
  cash,
  onEdit,
  onClose,
}: {
  trades: readonly JournalTrade[];
  cash: readonly JournalCashMovement[];
  onEdit: (trade: JournalTrade) => void;
  onClose: (trade: JournalTrade) => void;
}): React.ReactElement {
  const [filter, setFilter] = useState<Filter>("all");
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

  const removeCash = (c: JournalCashMovement): void =>
    startTransition(async () => {
      const result = await deleteCashMovementAction(c.id);
      if (result.success) toast.success(c.kind === "deposit" ? "Deposit deleted" : "Withdrawal deleted");
      else toast.error(result.error);
    });

  return (
    <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
      <Card className="gap-3 xl:col-span-3">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow size="sm" asChild>
            <h3>Trades</h3>
          </Eyebrow>
          <ToggleGroup
            type="single"
            size="sm"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            aria-label="Show trades"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="open">Open</ToggleGroupItem>
            <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <Text variant="small">No trades here yet.</Text>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                    <TableHead className="hidden md:table-cell">Setup</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((t) => (
                    <TableRow key={t.id} className={cn(pending && "opacity-70")}>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-medium">
                          {t.symbol}
                          <Badge variant="outline" className="px-1 text-2xs">
                            {t.side === "long" ? "Long" : "Short"}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">{formatDay(t.openedDay).replace(/, \d{4}$/, "")}</TableCell>
                      <TableCell className="text-right font-mono">
                        {price(t.quantity)}
                        {t.multiplier !== 1 && <span className="text-muted-foreground"> ×{t.multiplier}</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{price(t.entryPrice)}</TableCell>
                      <TableCell className="text-right font-mono">{t.exitPrice == null ? "—" : price(t.exitPrice)}</TableCell>
                      <TableCell className="font-mono">
                        {t.closedDay ? (
                          formatDay(t.closedDay).replace(/, \d{4}$/, "")
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
                                {(t.returnPct * 100).toFixed(1)}%
                              </Mono>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-32 truncate md:table-cell">{t.setup ?? "—"}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <Eyebrow size="sm" asChild>
            <h3>Deposits &amp; withdrawals</h3>
          </Eyebrow>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cash.length === 0 && <Text variant="small">No money moved yet.</Text>}
          {cash.map((c) => (
            <div key={c.id} className="group flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {c.kind === "deposit" ? (
                  <ArrowDownLeft className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{c.kind === "deposit" ? "Deposit" : "Withdrawal"}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {formatDay(c.day)}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Mono className={cn("text-sm", c.kind === "deposit" ? "text-success" : "text-destructive")}>
                  {c.kind === "deposit" ? "+" : "-"}
                  {formatCurrency(c.amount)}
                </Mono>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete this movement"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => removeCash(c)}
                >
                  <Trash2 />
                </Button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
