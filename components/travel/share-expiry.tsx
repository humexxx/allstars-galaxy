"use client";

import { useId, useState, useTransition } from "react";
import { CalendarClock, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { updateTripShareExpiryAction } from "@/app/actions/travel";
import { runAction } from "@/lib/actions/run";
import {
  EXPIRY_IN_PAST,
  draftForShare,
  isShareExpiryChoice,
  readerToday,
  resolveShareExpiry,
  shareExpiryLabel,
  tripEndExpiry,
  type ShareExpiryDraft,
  type ShareExpiryTrip,
} from "@/lib/travel/share-expiry";
import { formatDateTime, formatShortDay } from "@/lib/utils/date";
import type { TripShare } from "@/types/travel";

/**
 * Everything an expiry is worked out from. `now` is the panel's snapshot, so
 * every row agrees on what has passed; `timeZone` is the reader's, from the
 * `tz` cookie, so a day means the same thing here as on the server render.
 */
export type ShareExpiryContext = {
  trip: ShareExpiryTrip;
  timeZone: string;
  now: number;
};

/**
 * The instant to save, or an error message when the draft has none ahead of
 * now. Checked against a fresh clock: a preset counts from the click.
 */
export function expiryToSave(
  draft: ShareExpiryDraft,
  { trip, timeZone }: ShareExpiryContext
): { expiresAt: Date | null } | { error: string } {
  const now = Date.now();
  const expiresAt = resolveShareExpiry(draft, trip, timeZone, now);
  // NaN fails this too, which is what an unreadable day resolves to.
  if (expiresAt && !(expiresAt.getTime() > now)) return { error: EXPIRY_IN_PAST };
  return { expiresAt };
}

/** The choices themselves: the same control wherever a lifetime is picked. */
export function ShareExpiryField({
  id,
  value,
  onChange,
  context,
  disabled,
}: {
  id: string;
  value: ShareExpiryDraft;
  onChange: (next: ShareExpiryDraft) => void;
  context: ShareExpiryContext;
  disabled?: boolean;
}) {
  const { trip, timeZone, now } = context;
  const lastDay = tripEndExpiry(trip, timeZone, now) ? trip.endDate : null;

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={value.choice}
        onValueChange={(choice) => {
          if (isShareExpiryChoice(choice)) onChange({ ...value, choice });
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {lastDay && (
              <SelectItem value="trip-end">
                Until the trip ends
                {/* A calendar day, not an instant: no zone to pass. */}
                <span className="text-muted-foreground">{formatShortDay(lastDay)}</span>
              </SelectItem>
            )}
            <SelectItem value="1d">In 1 day</SelectItem>
            <SelectItem value="7d">In 7 days</SelectItem>
            <SelectItem value="30d">In 30 days</SelectItem>
            <SelectItem value="custom">On a date…</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {value.choice === "custom" && (
        <DateField
          aria-label="Expiry day"
          value={value.day}
          onChange={(day) => onChange({ ...value, day })}
          // Today still counts: the link then works until tonight.
          min={readerToday(timeZone, now)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

/**
 * A link's lifetime on its row: what it is, and a popover to change it.
 *
 * An expired link uses the same popover under "Extend" — a future expiry is
 * all it takes to bring it back. Revoked links never get one; the server
 * refuses them as well.
 */
export function ShareExpiryEditor({
  tripId,
  share,
  context,
  expired,
  who,
  onExtended,
}: {
  tripId: string;
  share: TripShare;
  context: ShareExpiryContext;
  expired: boolean;
  /** Who the link is for, so each row's control says which link it changes. */
  who: string;
  onExtended?: () => void;
}) {
  const id = useId();
  const { trip, timeZone, now } = context;
  const initial = (): ShareExpiryDraft => draftForShare(share.expiresAt, trip, timeZone, now);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ShareExpiryDraft>(initial);
  const [saving, startSave] = useTransition();

  const current = initial();
  // An expired link always has something to save: anything valid revives it.
  const changed =
    expired ||
    draft.choice !== current.choice ||
    (draft.choice === "custom" && draft.day !== current.day);

  const label = shareExpiryLabel(share.expiresAt, timeZone, now);

  const handleOpenChange = (next: boolean): void => {
    // Each opening starts from the link as it is, not from an abandoned edit.
    if (next) setDraft(initial());
    setOpen(next);
  };

  const handleSave = (): void => {
    const target = expiryToSave(draft, context);
    if ("error" in target) {
      toast.error(target.error);
      return;
    }
    startSave(async () => {
      const result = await runAction(
        updateTripShareExpiryAction(tripId, { shareId: share.id, expiresAt: target.expiresAt }),
        {
          success: expired ? "Link extended" : "Expiry updated",
          failure: "Failed to update the link",
        }
      );
      if (!result.ok) return;
      setOpen(false);
      // The row moves to the active list, and focus would go with it.
      if (expired) onExtended?.();
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {expired ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-8 sm:h-6"
            aria-label={`Extend the link for ${who}`}
          >
            <CalendarPlus data-icon="inline-start" />
            Extend
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            // Flush with the row's text, and 32px tall where it is tapped.
            className="-ml-1.5 h-8 self-start sm:h-6"
            aria-label={`${label}. Change when the link for ${who} expires`}
          >
            <CalendarClock data-icon="inline-start" />
            {label}
          </Button>
        )}
      </PopoverTrigger>
      {/* Opens toward the row from whichever side its trigger sits on, and
          keeps the 16px phone gutter instead of meeting the screen's edge. */}
      <PopoverContent align={expired ? "end" : "start"} collisionPadding={16}>
        <PopoverHeader>
          <PopoverTitle>{expired ? "Extend this link" : "Link expiry"}</PopoverTitle>
          <PopoverDescription>
            {share.expiresAt === null
              ? "Works until you revoke it."
              : expired
                ? `Stopped working ${formatDateTime(share.expiresAt, timeZone)}. A new expiry turns it back on.`
                : `Stops working ${formatDateTime(share.expiresAt, timeZone)}.`}
          </PopoverDescription>
        </PopoverHeader>
        <Field>
          {/* The title says it on screen; the select still needs a name. */}
          <FieldLabel htmlFor={id} className="sr-only">
            Expires
          </FieldLabel>
          <ShareExpiryField
            id={id}
            value={draft}
            onChange={setDraft}
            context={context}
            disabled={saving}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={!changed || saving}>
            {saving && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
