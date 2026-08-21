"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mono, Text } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  addTripContributionAction,
  deleteTripContributionAction,
} from "@/app/actions/travel";
import type { TripContribution } from "@/types/travel";
import { formatTripMoney, moneyRange } from "@/lib/travel/format";


export type PaymentsTraveller = {
  id: string;
  name: string;
  isYou: boolean;
  owedLow: number;
  owedHigh: number;
};

/**
 * What has actually been handed over, against what is estimated.
 *
 * Deliberately two different kinds of number. What somebody owes is a range,
 * because the trip is still mostly quotes; what they have paid is exact,
 * because money either moved or it did not. Rendering the paid figure as a
 * range too would suggest the bank statement is also an estimate.
 *
 * Follows the traveller selected upstairs for the same reason the itinerary
 * does: one selection, one answer everywhere on the page.
 */
export function TripPayments({
  tripId,
  currency,
  travellers,
  contributions,
  selected,
}: {
  tripId: string;
  currency: string;
  travellers: PaymentsTraveller[];
  contributions: TripContribution[];
  /** Traveller in focus, or null for everybody. */
  selected: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const byMember = useMemo(() => {
    const paid = new Map<string, number>();
    for (const c of contributions) {
      paid.set(c.memberId, (paid.get(c.memberId) ?? 0) + parseFloat(c.amount));
    }
    return paid;
  }, [contributions]);

  const shown = selected
    ? contributions.filter((c) => c.memberId === selected)
    : contributions;

  const focus = travellers.find((t) => t.id === selected) ?? null;

  const paid = focus
    ? (byMember.get(focus.id) ?? 0)
    : [...byMember.values()].reduce((a, b) => a + b, 0);
  const owedLow = focus
    ? focus.owedLow
    : travellers.reduce((sum, t) => sum + t.owedLow, 0);
  const owedHigh = focus
    ? focus.owedHigh
    : travellers.reduce((sum, t) => sum + t.owedHigh, 0);

  // Against the low estimate: it is the figure that can actually be settled,
  // and measuring progress against the high one would leave a fully-paid trip
  // reading as short.
  const pct = owedLow > 0 ? Math.min(100, (paid / owedLow) * 100) : 0;
  const left = Math.max(0, owedLow - paid);

  const open = contributions.find((c) => c.id === openId) ?? null;

  const nameOf = (memberId: string) =>
    travellers.find((t) => t.id === memberId)?.name ?? "Someone";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Payments
          {focus && (
            <Badge variant="outline" className="text-2xs font-normal">
              {focus.isYou ? "you" : focus.name}
            </Badge>
          )}
        </CardTitle>
        {/* CardAction, not a flex override on the header: CardHeader is a
            grid that grows a second column when it finds one. */}
        {travellers.length > 0 && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? (
                <X className="mr-1 size-3.5" />
              ) : (
                <Plus className="mr-1 size-3.5" />
              )}
              {adding ? "Cancel" : "Log payment"}
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 ">
        {travellers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No travellers yet"
            description="A payment has to come from somebody — add the people going first."
            className="border-dashed p-6"
          />
        ) : (
          <>
            <div className="flex flex-col gap-1.5 ">
              <div className="flex items-baseline justify-between gap-2">
                <Mono className="text-lg font-semibold tabular-nums">
                  {formatTripMoney(paid, currency)}
                </Mono>
                <Mono className="shrink-0 text-xs text-muted-foreground">
                  of {moneyRange(owedLow, owedHigh, currency)}
                </Mono>
              </div>
              <Progress value={pct} className="h-1.5" />
              <Text className="text-2xs text-muted-foreground">
                {left > 0 ? (
                  <>
                    {formatTripMoney(left, currency)} still to go
                    {owedHigh > owedLow && (
                      <> — up to {formatTripMoney(owedHigh - paid, currency)} if
                        every estimate lands high</>
                    )}
                  </>
                ) : (
                  "Covered against the low estimate."
                )}
              </Text>
            </div>

            {adding && (
              <PaymentForm
                tripId={tripId}
                currency={currency}
                travellers={travellers}
                defaultMemberId={selected ?? travellers[0]?.id}
                onDone={() => setAdding(false)}
              />
            )}

            {shown.length === 0 ? (
              <Text variant="small" className="text-muted-foreground">
                {focus
                  ? `Nothing from ${focus.isYou ? "you" : focus.name} yet.`
                  : "No payments logged yet."}
              </Text>
            ) : (
              <ul className="-mx-2 divide-y">
                {shown.map((c) => (
                  <PaymentRow
                    key={c.id}
                    contribution={c}
                    currency={currency}
                    // Hidden when the list is already one person's: repeating
                    // the name on every line says nothing.
                    who={focus ? null : nameOf(c.memberId)}
                    onOpen={() => setOpenId(c.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      {open && (
        <PaymentDialog
          tripId={tripId}
          contribution={open}
          currency={currency}
          who={nameOf(open.memberId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </Card>
  );
}

/**
 * A payment is a record, not a row of controls.
 *
 * The delete button used to sit at the right on hover, which meant every
 * amount was pushed a button's width off the edge to hold space for something
 * usually invisible. Tapping the record opens a dialog instead: the whole row
 * is the target, and the amount runs to the card's edge where the other
 * figures on this card are.
 */
function PaymentRow({
  contribution,
  currency,
  who,
  onOpen,
}: {
  contribution: TripContribution;
  currency: string;
  who: string | null;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <Text weight="medium" className="truncate text-sm">
            {who ?? contribution.note ?? "Payment"}
          </Text>
          <Mono className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
            {formatTripMoney(parseFloat(contribution.amount), currency)}
          </Mono>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {contribution.paidOn && (
            <Mono className="text-2xs">
              {format(new Date(`${contribution.paidOn}T00:00:00`), "d MMM yyyy")}
            </Mono>
          )}
          {who && contribution.note && <span className="truncate">{contribution.note}</span>}
        </span>
      </button>
    </li>
  );
}

/** What tapping a record opens: the detail, and the way to remove it. */
function PaymentDialog({
  tripId,
  contribution,
  currency,
  who,
  onClose,
}: {
  tripId: string;
  contribution: TripContribution;
  currency: string;
  who: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Payment from {who}</DialogTitle>
          <DialogDescription>
            {contribution.paidOn
              ? format(new Date(`${contribution.paidOn}T00:00:00`), "d MMMM yyyy")
              : "No date recorded"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Mono className="text-3xl font-semibold tabular-nums">
            {formatTripMoney(parseFloat(contribution.amount), currency)}
          </Mono>
          {contribution.note && <Text variant="small">{contribution.note}</Text>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteTripContributionAction(tripId, contribution.id);
                if (res.success) {
                  toast.success("Payment removed");
                  router.refresh();
                  onClose();
                } else {
                  toast.error(res.error);
                }
              })
            }
          >
            <Trash2 className="mr-1 size-3.5" />
            {busy ? "Removing…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  tripId,
  currency,
  travellers,
  defaultMemberId,
  onDone,
}: {
  tripId: string;
  currency: string;
  travellers: PaymentsTraveller[];
  defaultMemberId?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState(defaultMemberId ?? "");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error("Pick who paid");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || parseFloat(amount) <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    startTransition(async () => {
      const res = await addTripContributionAction(tripId, {
        memberId,
        amount,
        note: note.trim() || null,
        paidOn: paidOn || null,
      });
      if (res.success) {
        toast.success("Payment logged");
        router.refresh();
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-primary/30 bg-muted/30 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="gap-1.5">
          <FieldLabel className="text-xs">Who paid</FieldLabel>
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a traveller" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {travellers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.isYou ? `${t.name} (you)` : t.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="payment-amount" className="text-xs">Amount</FieldLabel>
          <MoneyInput
            id="payment-amount"
            value={amount}
            onChange={setAmount}
            currency={currency}
            placeholder="0.00"
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="payment-date" className="text-xs">Paid on</FieldLabel>
          <Input
            id="payment-date"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="payment-note" className="text-xs">
            Note <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="payment-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Bank transfer"
          />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Log payment"}
        </Button>
      </div>
    </form>
  );
}
