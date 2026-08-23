"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
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
} from "@/components/ui/select";
import { Mono, Text } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { currencySymbol } from "@/components/ui/money-input";
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


/** "Bruno Fabián" → "BF". A name does not fit in a field this narrow. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

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

            <PaymentEntry
              tripId={tripId}
              currency={currency}
              travellers={travellers}
              focused={focus}
            />

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

/** What tapping a record opens: the payment itself, editable. */
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
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [amount, setAmount] = useState(contribution.amount);
  const [note, setNote] = useState(contribution.note ?? "");
  const [paidOn, setPaidOn] = useState(contribution.paidOn ?? "");

  const busy = saving || deleting;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || parseFloat(amount) <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    startSave(async () => {
      const res = await updateTripContributionAction(tripId, {
        id: contribution.id,
        amount,
        note: note.trim() || null,
        paidOn: paidOn || null,
      });
      if (res.success) {
        toast.success("Payment updated");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Payment from {who}</DialogTitle>
          <DialogDescription>
            {/* Who paid is deliberately not editable: moving a payment to
                another person would rewrite two balances at once, and only
                one of them would be on screen. Delete it and log it again. */}
            Change what it was for, how much, or when. To move it to somebody
            else, remove it and log it again.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="edit-amount" className="text-xs">Amount</FieldLabel>
              <MoneyInput
                id="edit-amount"
                value={amount}
                onChange={setAmount}
                currency={currency}
                placeholder="0.00"
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="edit-date" className="text-xs">Paid on</FieldLabel>
              <Input
                id="edit-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
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
                    router.refresh();
                    onClose();
                  } else {
                    toast.error(res.error);
                  }
                })
              }
            >
              <Trash2 className="mr-1 size-3.5" />
              {deleting ? "Removing…" : "Delete"}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Logging a payment is one line, not a form.
 *
 * The amount is the only thing that cannot be guessed: the date is today, the
 * note is usually nothing, and who paid is whoever the card is already
 * showing. Anything else is a correction, and corrections belong in the
 * record you tap afterwards — which already edits all three.
 *
 * The old version was a labelled button in the card header that opened a
 * four-field panel to capture a number. This is the same control the gallery
 * uses to take a photo URL, for the same reason.
 */
function PaymentEntry({
  tripId,
  currency,
  travellers,
  focused,
}: {
  tripId: string;
  currency: string;
  travellers: PaymentsTraveller[];
  /** Traveller the card is filtered to, if any. */
  focused: PaymentsTraveller | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const you = travellers.find((t) => t.isYou) ?? travellers[0];
  const [memberId, setMemberId] = useState(you?.id ?? "");

  // When the card is showing one person, the payment is theirs — asking again
  // would be asking a question the page has already answered.
  const payer = focused ?? travellers.find((t) => t.id === memberId) ?? you;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payer) return;
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || parseFloat(amount) <= 0) {
      toast.error("Enter an amount above zero");
      return;
    }
    startTransition(async () => {
      const res = await addTripContributionAction(tripId, {
        memberId: payer.id,
        amount,
        note: null,
        paidOn: null,
      });
      if (res.success) {
        toast.success(`Logged ${formatTripMoney(parseFloat(amount), currency)}`);
        setAmount("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <InputGroup>
        <InputGroupAddon>
          {/* Initials, not a name: the full one ate a third of the field and
              the card already says whose money this is. */}
          {focused ? (
            <InputGroupText
              className="text-2xs font-medium"
              title={focused.isYou ? `${focused.name} (you)` : focused.name}
            >
              {initials(focused.name)}
            </InputGroupText>
          ) : (
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger
                size="sm"
                className="h-6 gap-1 border-0 bg-transparent px-1 text-2xs font-medium shadow-none"
                aria-label="Who paid"
              >
                {initials(payer?.name ?? "")}
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
          )}
          <InputGroupText className="text-muted-foreground">
            {currencySymbol(currency)}
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          inputMode="decimal"
          placeholder="Amount"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          disabled={isPending}
          // Mono for the digits, not for the word: the placeholder in a
          // monospace face read like a code sample rather than a prompt.
          className="font-mono tabular-nums placeholder:font-sans"
        />
        <InputGroupAddon align="inline-end">
          {/* An icon, not a filled "Add" chip glued to the end. The field is
              the control; this only says which way it goes. */}
          <InputGroupButton
            type="submit"
            size="icon-xs"
            disabled={isPending || !amount.trim()}
            aria-label="Log this payment"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
