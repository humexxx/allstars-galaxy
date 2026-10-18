"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Plus, Receipt, Trash2, Users } from "lucide-react";
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
import { DateField } from "@/components/ui/date-field";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { Spinner } from "@/components/ui/spinner";
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
  updateTripContributionAction,
} from "@/app/actions/travel";
import type { TripContribution } from "@/types/travel";
import { formatTripMoney, moneyRange } from "@/lib/travel/format";
import { isoDay } from "@/lib/travel/calendar";
import { formatDay } from "@/lib/utils/date";

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** Where focus goes when the payment it was on is deleted out from under it. */
  const logButtonRef = useRef<HTMLButtonElement>(null);

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
        {/* Same as the itinerary's badge: under the heading on a phone, where
            the row has Log payment at the other end and nothing to spare. */}
        <CardTitle
          as="h2"
          className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"
        >
          <span>Payments</span>
          {focus && (
            <Badge variant="outline" className="text-2xs font-normal">
              {focus.isYou ? "you" : focus.name}
            </Badge>
          )}
        </CardTitle>
        {/* CardAction, not a flex override on the header: CardHeader is a grid
            that grows a second column when it finds one. */}
        {travellers.length > 0 && (
          <CardAction>
            <Button
              ref={logButtonRef}
              size="sm"
              variant="outline"
              onClick={() => setAdding(true)}
            >
              <Plus /> Log payment
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {travellers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No travellers yet"
            description="A payment has to come from somebody — add the people going first."
          />
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {formatTripMoney(paid, currency)}
                </Mono>
                <Mono className="shrink-0 text-xs text-muted-foreground">
                  of {moneyRange(owedLow, owedHigh, currency)}
                </Mono>
              </div>
              <Progress value={pct} aria-label="Paid so far" />
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

            {shown.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={
                  focus
                    ? `Nothing from ${focus.isYou ? "you" : focus.name} yet`
                    : "No payments logged yet"
                }
              />
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

      {/* One dialog, two jobs. Logging a payment and correcting one ask for
          the same four things, and giving them separate forms made them look
          like different work. */}
      {open && (
        <PaymentDialog
          tripId={tripId}
          contribution={open}
          currency={currency}
          travellers={travellers}
          onClose={() => setOpenId(null)}
          focusAfterDelete={logButtonRef}
        />
      )}
      {adding && (
        <PaymentDialog
          tripId={tripId}
          currency={currency}
          travellers={travellers}
          payerId={focus?.id}
          onClose={() => setAdding(false)}
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
          <Text weight="medium" className="truncate">
            {who ?? contribution.note ?? "Payment"}
          </Text>
          <Mono className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
            {formatTripMoney(parseFloat(contribution.amount), currency)}
          </Mono>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {contribution.paidOn && (
            <Mono className="text-2xs">
              {formatDay(contribution.paidOn)}
            </Mono>
          )}
          {who && contribution.note && <span className="truncate">{contribution.note}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * One payment, whether it exists yet or not.
 *
 * Logging and correcting ask for the same four things, so they are the same
 * form — separate ones made the two look like different work, and the second
 * had to be kept in step with the first by hand.
 *
 * Who paid is fixed once a payment exists: moving it to another person
 * rewrites two balances at once and only one of them is on screen. Delete it
 * and log it again, where both changes are visible as what they are.
 */
function PaymentDialog({
  tripId,
  contribution,
  currency,
  travellers,
  payerId,
  onClose,
  focusAfterDelete,
}: {
  tripId: string;
  /** Absent when logging a new one. */
  contribution?: TripContribution;
  currency: string;
  travellers: PaymentsTraveller[];
  /**
   * Fixed payer for a new payment — set when the card is already filtered to
   * one traveller. Its presence IS the decision, so the form does not ask.
   */
  payerId?: string;
  onClose: () => void;
  /**
   * The row that opened this dialog is gone once its payment is deleted, and
   * Radix would hand focus back to it — i.e. to nothing, dropping a keyboard
   * user at the top of the page.
   */
  focusAfterDelete?: React.RefObject<HTMLButtonElement | null>;
}) {
  const removed = useRef(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [amount, setAmount] = useState(contribution?.amount ?? "");
  const [note, setNote] = useState(contribution?.note ?? "");
  const [paidOn, setPaidOn] = useState(
    // The local day, not the UTC one: `toISOString()` west of Greenwich in
    // the evening already reads as tomorrow, so a payment logged tonight was
    // dated for a day that has not happened.
    contribution?.paidOn ?? isoDay(new Date())
  );
  const [memberId, setMemberId] = useState(
    contribution?.memberId ??
      payerId ??
      travellers.find((t) => t.isYou)?.id ??
      travellers[0]?.id ??
      ""
  );

  const [amountError, setAmountError] = useState<string | null>(null);

  const busy = saving || deleting;
  const payer = travellers.find((t) => t.id === (contribution?.memberId ?? memberId));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || parseFloat(amount) <= 0) {
      setAmountError("Enter an amount above zero");
      return;
    }
    setAmountError(null);
    if (!contribution && !memberId) {
      toast.error("Pick who paid");
      return;
    }
    startSave(async () => {
      const res = contribution
        ? await updateTripContributionAction(tripId, {
            id: contribution.id,
            amount,
            note: note.trim() || null,
            paidOn: paidOn || null,
          })
        : await addTripContributionAction(tripId, {
            memberId,
            amount,
            note: note.trim() || null,
            paidOn: paidOn || null,
          });
      if (res.success) {
        toast.success(contribution ? "Payment updated" : "Payment logged");
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-sm"
        onCloseAutoFocus={(e) => {
          if (!removed.current || !focusAfterDelete?.current) return;
          e.preventDefault();
          focusAfterDelete.current.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {contribution ? `Payment from ${payer?.name ?? "somebody"}` : "Log a payment"}
          </DialogTitle>
          <DialogDescription>
            {contribution
              ? "Change what it was for, how much, or when. To move it to somebody else, remove it and log it again."
              : "Money that has actually changed hands — not what is still owed."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {!contribution && !payerId && travellers.length > 1 && (
            <Field className="gap-1.5">
              <FieldLabel htmlFor="payment-payer" className="text-xs">
                Who paid
              </FieldLabel>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger id="payment-payer" className="w-full">
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
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1.5" data-invalid={!!amountError}>
              <FieldLabel htmlFor="edit-amount" className="text-xs">Amount</FieldLabel>
              <MoneyInput
                id="edit-amount"
                value={amount}
                onChange={setAmount}
                currency={currency}
                placeholder="0.00"
                aria-invalid={!!amountError}
              />
              <FieldError>{amountError}</FieldError>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="edit-date" className="text-xs">Paid on</FieldLabel>
              <DateField
                id="edit-date"
                value={paidOn}
                onChange={setPaidOn}
                placeholder="Not recorded"
                clearable
              />
            </Field>
          </div>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="edit-note" className="text-xs">
              Note <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bank transfer"
            />
          </Field>

          <DialogFooter className="sm:justify-between">
            {contribution ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() =>
                startDelete(async () => {
                  const res = await deleteTripContributionAction(tripId, contribution.id);
                  if (res.success) {
                    toast.success("Payment removed");
                    removed.current = true;
                    onClose();
                  } else {
                    toast.error(res.error);
                  }
                })
              }
            >
              {deleting ? <Spinner /> : <Trash2 />}
              {deleting ? "Removing…" : "Delete"}
            </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {saving && <Spinner />}
                {saving ? "Saving…" : contribution ? "Save" : "Log payment"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
