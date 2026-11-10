"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addCashMovementAction,
  closeTradeAction,
  createTradeAction,
  updateTradeAction,
} from "@/app/actions/trading-journal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Mono, Text } from "@/components/ui/typography";
import { tradePnl } from "@/lib/finance/trading";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalTrade, TradeSide, TradingCashKind } from "@/types/trading";

/** `YYYY-MM-DDTHH:mm` for a datetime-local input, on the browser's clock. */
export function localInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value back to an instant, read on the browser's clock. */
const toInstant = (value: string): string => new Date(value).toISOString();

const num = (v: string): number => (v.trim() === "" ? NaN : Number(v));

type TradeForm = {
  symbol: string;
  side: TradeSide;
  quantity: string;
  multiplier: string;
  entryPrice: string;
  exitPrice: string;
  openedAt: string;
  closedAt: string;
  fees: string;
  setup: string;
  notes: string;
};

function formFor(trade: JournalTrade | null): TradeForm {
  return {
    symbol: trade?.symbol ?? "",
    side: trade?.side ?? "long",
    quantity: trade ? String(trade.quantity) : "",
    multiplier: trade ? String(trade.multiplier) : "1",
    entryPrice: trade ? String(trade.entryPrice) : "",
    exitPrice: trade?.exitPrice != null ? String(trade.exitPrice) : "",
    openedAt: localInputValue(trade ? new Date(trade.openedAt) : new Date()),
    closedAt: trade?.closedAt ? localInputValue(new Date(trade.closedAt)) : "",
    fees: trade ? String(trade.fees) : "0",
    setup: trade?.setup ?? "",
    notes: trade?.notes ?? "",
  };
}

/**
 * A trade in the journal: opened now (leave the exit empty) or already
 * closed. Its P&L is worked out as you type, the way the journal will count it.
 */
export function TradeDialog({
  open,
  onOpenChange,
  trade,
  setups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trade to edit; null for a new one. */
  trade: JournalTrade | null;
  /** Setups already used, offered as suggestions. */
  setups: string[];
}): React.ReactElement {
  const [form, setForm] = useState<TradeForm>(() => formFor(trade));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<JournalTrade | null>(trade);
  if (seed !== trade) {
    setSeed(trade);
    setForm(formFor(trade));
    setError(null);
  }

  const set = <K extends keyof TradeForm>(key: K, value: TradeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const closing = form.exitPrice.trim() !== "" || form.closedAt.trim() !== "";
  const preview = tradePnl({
    side: form.side,
    quantity: num(form.quantity) || 0,
    multiplier: num(form.multiplier) || 1,
    entryPrice: num(form.entryPrice) || 0,
    exitPrice: form.exitPrice.trim() === "" ? null : num(form.exitPrice),
    fees: num(form.fees) || 0,
  });

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    const payload = {
      symbol: form.symbol,
      side: form.side,
      quantity: form.quantity,
      multiplier: form.multiplier || "1",
      entryPrice: form.entryPrice,
      exitPrice: closing ? form.exitPrice : null,
      openedAt: toInstant(form.openedAt),
      closedAt: closing && form.closedAt ? toInstant(form.closedAt) : null,
      fees: form.fees || "0",
      setup: form.setup || null,
      notes: form.notes || null,
    };
    startTransition(async () => {
      const result = trade
        ? await updateTradeAction({ id: trade.id, ...payload })
        : await createTradeAction(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(trade ? "Trade updated" : "Trade added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{trade ? `Edit ${trade.symbol}` : "New trade"}</DialogTitle>
            <DialogDescription>
              Leave the exit empty while the trade is open; close it later from the journal.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-symbol">Symbol</FieldLabel>
              <Input
                id="trade-symbol"
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="AAPL, BTC, ES"
                autoComplete="off"
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel>Side</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={form.side}
                onValueChange={(v) => v && set("side", v as TradeSide)}
                aria-label="Side"
                className="w-full"
              >
                <ToggleGroupItem value="long" className="flex-1">
                  Long
                </ToggleGroupItem>
                <ToggleGroupItem value="short" className="flex-1">
                  Short
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-quantity">Quantity</FieldLabel>
              <Input
                id="trade-quantity"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-multiplier">Multiplier</FieldLabel>
              <Input
                id="trade-multiplier"
                inputMode="decimal"
                value={form.multiplier}
                onChange={(e) => set("multiplier", e.target.value)}
                title="1 for shares and crypto, 100 for options, the point value for futures"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-entry">Entry price</FieldLabel>
              <Input
                id="trade-entry"
                inputMode="decimal"
                value={form.entryPrice}
                onChange={(e) => set("entryPrice", e.target.value)}
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-opened">Opened</FieldLabel>
              <Input
                id="trade-opened"
                type="datetime-local"
                value={form.openedAt}
                onChange={(e) => set("openedAt", e.target.value)}
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-exit">Exit price</FieldLabel>
              <Input
                id="trade-exit"
                inputMode="decimal"
                value={form.exitPrice}
                onChange={(e) => set("exitPrice", e.target.value)}
                placeholder="Open"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-closed">Closed</FieldLabel>
              <Input
                id="trade-closed"
                type="datetime-local"
                value={form.closedAt}
                onChange={(e) => set("closedAt", e.target.value)}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-fees">Fees</FieldLabel>
              <Input
                id="trade-fees"
                inputMode="decimal"
                value={form.fees}
                onChange={(e) => set("fees", e.target.value)}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-setup">Setup</FieldLabel>
              <Input
                id="trade-setup"
                list="trade-setups"
                value={form.setup}
                onChange={(e) => set("setup", e.target.value)}
                placeholder="Breakout, Pullback…"
              />
              <datalist id="trade-setups">
                {setups.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field className="gap-2 sm:col-span-2">
              <FieldLabel htmlFor="trade-notes">Notes</FieldLabel>
              <Textarea
                id="trade-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Why you took it, how you managed it, what you'd repeat."
              />
            </Field>
          </FieldGroup>

          {preview != null && Number.isFinite(preview) && (
            <div className="flex items-baseline justify-between rounded-lg bg-muted/50 px-3 py-2">
              <Text variant="small" as="span">
                P&amp;L after fees
              </Text>
              <Mono
                className={
                  moneySign(preview) > 0 ? "text-success" : moneySign(preview) < 0 ? "text-destructive" : undefined
                }
              >
                {formatSignedCurrency(preview)}
              </Mono>
            </div>
          )}

          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {trade ? "Save" : "Add trade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Closing an open trade: the exit price, when, and the closing order's fees. */
export function CloseTradeDialog({
  trade,
  onOpenChange,
}: {
  trade: JournalTrade | null;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [exitPrice, setExitPrice] = useState("");
  const [closedAt, setClosedAt] = useState(() => localInputValue());
  const [fees, setFees] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<JournalTrade | null>(trade);
  if (seed !== trade) {
    setSeed(trade);
    setExitPrice("");
    setClosedAt(localInputValue());
    setFees("0");
    setError(null);
  }

  const preview =
    trade && exitPrice.trim() !== ""
      ? tradePnl({ ...trade, exitPrice: num(exitPrice), fees: trade.fees + (num(fees) || 0) })
      : null;

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!trade) return;
    setError(null);
    startTransition(async () => {
      const result = await closeTradeAction({
        id: trade.id,
        exitPrice,
        closedAt: toInstant(closedAt),
        fees: fees || "0",
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(`${trade.symbol} closed · ${formatSignedCurrency(result.data.pnl ?? 0)}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={trade !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Close {trade?.symbol}</DialogTitle>
            <DialogDescription>
              {trade
                ? `${trade.side === "long" ? "Long" : "Short"} ${trade.quantity} at ${trade.entryPrice}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="close-exit">Exit price</FieldLabel>
              <Input
                id="close-exit"
                inputMode="decimal"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="close-at">Closed</FieldLabel>
              <Input
                id="close-at"
                type="datetime-local"
                value={closedAt}
                onChange={(e) => setClosedAt(e.target.value)}
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="close-fees">Closing fees</FieldLabel>
              <Input id="close-fees" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
            </Field>
          </FieldGroup>
          {preview != null && Number.isFinite(preview) && (
            <div className="flex items-baseline justify-between rounded-lg bg-muted/50 px-3 py-2">
              <Text variant="small" as="span">
                P&amp;L after fees
              </Text>
              <Mono className={preview >= 0 ? "text-success" : "text-destructive"}>
                {formatSignedCurrency(preview)}
              </Mono>
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Close trade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Money into or out of the trading account. */
export function CashDialog({
  kind,
  onOpenChange,
  balance,
}: {
  /** Which movement; null keeps the dialog closed. */
  kind: TradingCashKind | null;
  onOpenChange: (open: boolean) => void;
  balance: number;
}): React.ReactElement {
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => localInputValue());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<TradingCashKind | null>(kind);
  if (seed !== kind) {
    setSeed(kind);
    setAmount("");
    setOccurredAt(localInputValue());
    setNote("");
    setError(null);
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!kind) return;
    setError(null);
    startTransition(async () => {
      const result = await addCashMovementAction({
        kind,
        amount,
        occurredAt: toInstant(occurredAt),
        note: note || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(kind === "deposit" ? "Deposit added" : "Withdrawal added");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{kind === "withdrawal" ? "Withdraw" : "Deposit"}</DialogTitle>
            <DialogDescription>
              {kind === "withdrawal"
                ? `Money taken out of the trading account. ${formatCurrency(balance)} is in it now.`
                : "Money put into the trading account."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="cash-amount">Amount</FieldLabel>
              <Input
                id="cash-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="cash-at">When</FieldLabel>
              <Input
                id="cash-at"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="cash-note">Note</FieldLabel>
              <Input id="cash-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FieldGroup>
          {error && <FieldError>{error}</FieldError>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {kind === "withdrawal" ? "Withdraw" : "Deposit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
