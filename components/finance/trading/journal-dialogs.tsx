"use client";

import { useState, useTransition } from "react";
import { Diff } from "lucide-react";
import { toast } from "sonner";

import {
  addCashMovementAction,
  closeTradeAction,
  createTradeAction,
  updateTradeAction,
} from "@/app/actions/trading-journal";
import { Button } from "@/components/ui/button";
import { DateTimeField, toLocalDateTime } from "@/components/ui/date-time-field";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { balanceBefore, positionLabel } from "@/lib/finance/trading";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalCashMovement, JournalTrade, TradingCashKind, TradingInstrument } from "@/types/trading";

import { InstrumentCombobox } from "./instrument-combobox";

/** A picked day and time back to an instant, read on the browser's clock. */
const toInstant = (value: string): string => new Date(value).toISOString();

const num = (v: string): number => (v.trim() === "" ? NaN : Number(v));

/** Later than any instant the journal holds: the balance a trade with no close time is read against. */
const SO_FAR = "9999-12-31T23:59:59.999Z";

/** A signed amount as it is typed: an optional minus, digits, one dot, two decimals. */
function signedAmount(raw: string): string {
  const [head, ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  const amount = rest.length > 0 ? `${head}.${rest.join("").slice(0, 2)}` : head;
  return /^\s*[-−]/.test(raw) ? `-${amount}` : amount;
}

/**
 * What a trade made, in dollars and as a share of what the account held when
 * it closed (`base`). The dollars are what the journal keeps; typing the
 * percentage works them out.
 */
function PnlFields({
  id,
  value,
  onChange,
  base,
  autoFocus,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  base: number;
  autoFocus?: boolean;
  className?: string;
}): React.ReactElement {
  // The percentage as it is being typed, and the balance it was typed against.
  const [draft, setDraft] = useState<{ text: string; base: number } | null>(null);
  const pnl = num(value);
  const share = Number.isFinite(pnl) && base > 0 ? String(Math.round((pnl / base) * 10000) / 100) : "";
  const pct = draft && draft.base === base ? draft.text : share;
  const sign = Number.isFinite(pnl) ? moneySign(pnl) : 0;
  const tone = sign > 0 ? "text-success" : sign < 0 ? "text-destructive" : undefined;

  const typeAmount = (text: string): void => {
    setDraft(null);
    onChange(signedAmount(text));
  };
  const typePct = (text: string): void => {
    const cleaned = signedAmount(text);
    setDraft({ text: cleaned, base });
    const n = num(cleaned);
    onChange(Number.isFinite(n) ? (Math.round(base * n) / 100).toFixed(2) : "");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-2 gap-3">
        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-pnl`}>P&amp;L</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id={`${id}-pnl`}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => typeAmount(e.target.value)}
              placeholder="0.00"
              autoFocus={autoFocus}
              className={cn("font-mono tabular-nums", tone)}
            />
            <InputGroupAddon align="inline-end">
              {/* A phone's decimal keypad has no minus key. */}
              <InputGroupButton
                size="icon-xs"
                aria-label={value.startsWith("-") ? "Make it a gain" : "Make it a loss"}
                onClick={() => typeAmount(value.startsWith("-") ? value.slice(1) : `-${value}`)}
              >
                <Diff />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-pct`}>Return</FieldLabel>
          <InputGroup data-disabled={base <= 0}>
            <InputGroupInput
              id={`${id}-pct`}
              inputMode="decimal"
              autoComplete="off"
              value={pct}
              onChange={(e) => typePct(e.target.value)}
              onBlur={() => setDraft(null)}
              placeholder="0"
              disabled={base <= 0}
              className={cn("font-mono tabular-nums", tone)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
      <Text variant="small" as="p" className="text-2xs">
        {base > 0
          ? `The return is the P&L over the ${formatCurrency(base)} the account held then. Type either one.`
          : "The account held nothing then, so there is no return to work out."}
      </Text>
    </div>
  );
}

type TradeForm = {
  symbol: string;
  openedAt: string;
  closedAt: string;
  pnl: string;
  notes: string;
};

function formFor(trade: JournalTrade | null): TradeForm {
  return {
    symbol: trade?.symbol ?? "",
    openedAt: toLocalDateTime(trade ? new Date(trade.openedAt) : new Date()),
    closedAt: trade?.closedAt ? toLocalDateTime(new Date(trade.closedAt)) : "",
    pnl: trade?.pnl != null ? String(trade.pnl) : "",
    notes: trade?.notes ?? "",
  };
}

/**
 * A trade in the journal: what was traded, when it opened, and — once it has
 * closed — when, and what it made. Leave Closed empty while it is still open.
 */
export function TradeDialog({
  open,
  onOpenChange,
  trade,
  trades,
  cash,
  linked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trade to edit; null for a new one. */
  trade: JournalTrade | null;
  /** The journal, for the balance a return is measured against and the symbols it already holds. */
  trades: readonly JournalTrade[];
  cash: readonly JournalCashMovement[];
  /** The assets linked for pricing, offered as instruments. */
  linked: readonly TradingInstrument[];
}): React.ReactElement {
  const [form, setForm] = useState<TradeForm>(() => formFor(trade));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState({ trade, open });
  if (seed.trade !== trade || seed.open !== open) {
    setSeed({ trade, open });
    if (open) {
      setForm(formFor(trade));
      setError(null);
    }
  }

  const set = <K extends keyof TradeForm>(key: K, value: TradeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const recent = [
    ...new Set([...trades].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).map((t) => t.symbol)),
  ];
  const base = balanceBefore(trades, cash, form.closedAt ? toInstant(form.closedAt) : SO_FAR, trade?.id);
  const position = trade ? positionLabel(trade) : null;

  const setPnl = (pnl: string): void => {
    // A result means the trade closed: it closes now unless a time was given.
    const now = toLocalDateTime();
    setForm((f) => ({ ...f, pnl, closedAt: f.closedAt || (Number.isFinite(num(pnl)) ? now : "") }));
  };
  const setClosedAt = (closedAt: string): void =>
    setForm((f) => ({ ...f, closedAt, pnl: closedAt === "" ? "" : f.pnl }));

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    setError(null);
    if (!form.symbol) {
      setError("Pick the instrument you traded");
      return;
    }
    const closed = form.closedAt !== "";
    const pnl = num(form.pnl);
    if (closed && !Number.isFinite(pnl)) {
      setError("Enter what the trade made, or clear Closed while it is still open");
      return;
    }
    const payload = {
      symbol: form.symbol,
      openedAt: toInstant(form.openedAt),
      closedAt: closed ? toInstant(form.closedAt) : null,
      pnl: closed ? pnl : null,
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
              {position
                ? `${position}. The position stays as recorded; a new P&L moves its exit price.`
                : "Leave Closed empty while the trade is still open; close it later from the journal."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-2 sm:col-span-2">
              <FieldLabel htmlFor="trade-instrument">Instrument</FieldLabel>
              <InstrumentCombobox
                id="trade-instrument"
                value={form.symbol}
                onChange={(symbol) => set("symbol", symbol)}
                linked={linked}
                recent={recent}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-opened">Opened</FieldLabel>
              <DateTimeField
                id="trade-opened"
                value={form.openedAt}
                onChange={(value) => set("openedAt", value)}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="trade-closed">
                Closed <span className="font-normal text-muted-foreground">optional</span>
              </FieldLabel>
              <DateTimeField
                id="trade-closed"
                value={form.closedAt}
                onChange={setClosedAt}
                placeholder="Still open"
                min={form.openedAt}
                clearable
                clearLabel="Clear the close: the trade is still open"
              />
            </Field>
            <PnlFields id="trade" value={form.pnl} onChange={setPnl} base={base} className="sm:col-span-2" />
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

/** Closing an open trade: what it made, and when. */
export function CloseTradeDialog({
  trade,
  onOpenChange,
  trades,
  cash,
}: {
  trade: JournalTrade | null;
  onOpenChange: (open: boolean) => void;
  /** The journal, for the balance the return is measured against. */
  trades: readonly JournalTrade[];
  cash: readonly JournalCashMovement[];
}): React.ReactElement {
  const [pnl, setPnl] = useState("");
  const [closedAt, setClosedAt] = useState(() => toLocalDateTime());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<JournalTrade | null>(trade);
  if (seed !== trade) {
    setSeed(trade);
    setPnl("");
    setClosedAt(toLocalDateTime());
    setError(null);
  }

  const base = balanceBefore(trades, cash, closedAt ? toInstant(closedAt) : SO_FAR, trade?.id);

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!trade) return;
    setError(null);
    const made = num(pnl);
    if (!Number.isFinite(made)) {
      setError("Enter what the trade made");
      return;
    }
    startTransition(async () => {
      const result = await closeTradeAction({ id: trade.id, pnl: made, closedAt: toInstant(closedAt) });
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
              {trade ? (positionLabel(trade) ?? `Opened ${formatDay(trade.openedDay)}`) : null}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            <PnlFields id="close" value={pnl} onChange={setPnl} base={base} autoFocus />
            <Field className="gap-2">
              <FieldLabel htmlFor="close-at">Closed</FieldLabel>
              <DateTimeField
                id="close-at"
                value={closedAt}
                onChange={setClosedAt}
                min={trade ? toLocalDateTime(new Date(trade.openedAt)) : undefined}
              />
            </Field>
          </FieldGroup>
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
  const [occurredAt, setOccurredAt] = useState(() => toLocalDateTime());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState<TradingCashKind | null>(kind);
  if (seed !== kind) {
    setSeed(kind);
    setAmount("");
    setOccurredAt(toLocalDateTime());
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
              <DateTimeField id="cash-at" value={occurredAt} onChange={setOccurredAt} />
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
