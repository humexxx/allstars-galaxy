"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ListOrdered, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Text } from "@/components/ui/typography";
import { MoneyInput } from "@/components/ui/money-input";

import {
  addTripItemAction,
  addTripPhotoAction,
  deleteTripItemAction,
  deleteTripPhotoAction,
  updateTripItemAction,
} from "@/app/actions/travel";
import type {
  TripItemCategory,
  TripItemWithStops,
  TripPriceUnit,
} from "@/types/travel";
import {
  allowsPriceUnit,
  deriveTitle,
  endDayLabel,
  itemFields,
  priceUnitOptions,
  showsEndDay,
} from "@/lib/travel/item-fields";
import { AirportPicker } from "@/components/travel/airport-picker";
import { ItineraryEditor } from "@/components/travel/itinerary-editor";
import { PhotoPicker } from "@/components/travel/photo-picker";
import { CATEGORIES, categoryMeta, CategoryIcon } from "@/components/travel/category";

type FormErrors = Partial<Record<"title" | "price" | "priceMax" | "endsOn", string>>;

const PRICE_UNIT_LABELS: Record<TripPriceUnit, string> = {
  total: "a total",
  per_night: "per night",
  per_person: "per person",
};

/**
 * The one form behind every way into an item.
 *
 * Lives on its own because both views open it — the itinerary from a row, the
 * calendar from a bar — and reaching into the itinerary for it would drag the
 * whole list along with it.
 */
type Traveller = { id: string; name: string };

/** "Ana and Alejandra", or "Jason, Ana and Alejandra". */
function names(ids: string[], travellers: Traveller[]): string {
  const picked = ids.map((id) => travellers.find((t) => t.id === id)?.name ?? "?");
  if (picked.length <= 1) return picked.join("");
  return `${picked.slice(0, -1).join(", ")} and ${picked[picked.length - 1]}`;
}

/** The "Everyone" chip's value inside the group; never saved. */
const EVERYONE = "__everyone__";

/**
 * A row of traveller chips where an empty selection means everybody.
 *
 * "Everyone" is the absence of a choice, not a choice of its own — an empty
 * list is already what both of these fields mean by "all of them". It sits in
 * the same multi-select group so the whole row is one control with one name,
 * and every chip announces whether it is pressed.
 */
function TravellerChips({
  label,
  travellers,
  selected,
  onChange,
  allLabel,
  hint,
}: {
  label: string;
  travellers: Traveller[];
  selected: string[];
  onChange: (ids: string[]) => void;
  allLabel: string;
  hint: string;
}) {
  return (
    <FieldSet className="gap-1">
      <FieldLegend variant="label" className="mb-1 text-xs">
        {label}
      </FieldLegend>
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={selected.length === 0 ? [EVERYONE] : selected}
        onValueChange={(next) => {
          // Pressing "Everyone" clears the named travellers; pressing a name
          // releases "Everyone". Pressing "Everyone" again leaves it on — it
          // is what an empty selection means.
          const choseEveryone = next.includes(EVERYONE) && selected.length > 0;
          onChange(choseEveryone ? [] : next.filter((id) => id !== EVERYONE));
        }}
      >
        {/* `flex-none`: the group item is `flex-1 min-w-0` for segmented
            controls, which in a wrapping row of chips never wraps — every
            chip shrank to a share of one line and the names printed over
            each other. A chip is as wide as its name. */}
        <ToggleGroupItem value={EVERYONE} className="flex-none rounded-full px-3">
          {allLabel}
        </ToggleGroupItem>
        {travellers.map((t) => (
          <ToggleGroupItem key={t.id} value={t.id} className="flex-none rounded-full px-3">
            {t.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Text variant="small">{hint}</Text>
    </FieldSet>
  );
}

export function ItemForm({
  tripId,
  item,
  defaultDate,
  currency,
  travellers = [],
  onDone,
}: {
  tripId: string;
  item?: TripItemWithStops;
  defaultDate?: string | null;
  /** Drives the symbol shown inside the amount fields. */
  currency: string;
  /** Who is on the trip, so this item can name who is covering it. */
  travellers?: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [title, setTitle] = useState(item?.title ?? "");
  const [category, setCategory] = useState<TripItemCategory>(item?.category ?? "activity");
  const [link, setLink] = useState(item?.link ?? "");
  const [price, setPrice] = useState(item?.price ?? "");
  const [priceMax, setPriceMax] = useState(item?.priceMax ?? "");
  const [fromCode, setFromCode] = useState(item?.fromCode ?? "");
  const [toCode, setToCode] = useState(item?.toCode ?? "");
  const [scheduledOn, setScheduledOn] = useState(item?.scheduledOn ?? defaultDate ?? "");
  const [endsOn, setEndsOn] = useState(item?.endsOn ?? "");
  const [roundTrip, setRoundTrip] = useState(item?.roundTrip ?? false);
  const [editingStops, setEditingStops] = useState(false);
  const [priceUnit, setPriceUnit] = useState<TripPriceUnit>(
    item?.priceUnit ?? itemFields(item?.category ?? "activity").defaultPriceUnit
  );

  const fields = itemFields(category);
  const showEnd = showsEndDay(fields, roundTrip);
  const [videoUrl, setVideoUrl] = useState(item?.videoUrl ?? "");
  /**
   * Photos picked before the item exists.
   *
   * A new item has no id to attach them to, so they wait here and are
   * attached once the insert returns one. Uploading them first and losing
   * them on cancel would be worse than the wait.
   */
  const [pending, setPending] = useState<
    { url: string; storagePath: string | null; source: "upload" | "url" }[]
  >([]);
  const [notes, setNotes] = useState(item?.notes ?? "");
  /** Empty means the trip's own split — the common case, so it is the default. */
  const [payerIds, setPayerIds] = useState<string[]>(item?.payerIds ?? []);
  /** Empty means everybody is on it, which is also the common case. */
  const [attendeeIds, setAttendeeIds] = useState<string[]>(item?.attendeeIds ?? []);
  const [errors, setErrors] = useState<FormErrors>({});

  /** Saved photos and picked-but-unsaved ones, shown as one strip. */
  const shownPhotos = [
    ...(item?.photos ?? []).map((p) => ({ key: p.id, url: p.url, id: p.id })),
    ...pending.map((p, i) => ({ key: `pending-${i}`, url: p.url, id: null })),
  ];

  const removePhoto = (photo: { id: string | null; url: string }) => {
    const photoId = photo.id;
    if (!photoId) {
      setPending((p) => p.filter((x) => x.url !== photo.url));
      return;
    }
    startTransition(async () => {
      const res = await deleteTripPhotoAction(tripId, photoId);
      if (!res.success) toast.error(res.error);
    });
  };

  const handleDelete = () => {
    if (!item) return;
    startDelete(async () => {
      const res = await deleteTripItemAction(tripId, item.id);
      if (res.success) {
        toast.success("Item removed");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveTitle = fields.title
      ? title.trim()
      : deriveTitle(category, { fromCode, toCode, roundTrip }, categoryMeta(category).label);
    // Reported beside the field that is wrong, not in a toast that vanishes
    // and names no field.
    const money = /^\d+(\.\d{1,2})?$/;
    const found: FormErrors = {};
    if (!effectiveTitle) found.title = "Item needs a title";
    if (price && !money.test(price)) {
      found.price = "A non-negative number with up to 2 decimals";
    }
    if (priceMax && !money.test(priceMax)) {
      found.priceMax = "A non-negative number with up to 2 decimals";
    } else if (price && priceMax && parseFloat(priceMax) < parseFloat(price)) {
      // A range that runs backwards is a typo, and silently storing it would
      // make the trip total nonsense.
      found.priceMax = "Cannot be below the price";
    }
    if (showEnd && endsOn && scheduledOn && endsOn < scheduledOn) {
      found.endsOn = "Cannot be before the start day";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Take the reader to it. On a phone the form is a scrolled sheet and
      // the submit button sits a screen below the title: tapping it showed an
      // error nobody could see, and the button simply seemed to do nothing.
      const form = e.currentTarget as HTMLFormElement;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      );
      return;
    }

    startTransition(async () => {
      const payload = {
        title: effectiveTitle,
        category,
        link: link.trim() || null,
        price: price.trim() || null,
        priceMax: priceMax.trim() || null,
        priceUnit,
        fromCode: fromCode.trim() || null,
        toCode: toCode.trim() || null,
        roundTrip,
        scheduledOn: scheduledOn || null,
        // The field is hidden for categories without a stay (and one-way
        // flights); the old value must not ride along invisibly.
        endsOn: showEnd ? endsOn || null : null,
        videoUrl: videoUrl.trim() || null,
        notes: notes.trim() || null,
        payerIds,
        attendeeIds,
      };
      const res = item
        ? await updateTripItemAction(tripId, { id: item.id, ...payload })
        : await addTripItemAction(tripId, payload);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      let failedPhotos = 0;
      if (!item && pending.length > 0) {
        // Sequential on purpose: sortOrder is the order they were picked in,
        // and firing them together would race for it.
        for (let i = 0; i < pending.length; i++) {
          const photo = await addTripPhotoAction(tripId, {
            ...pending[i],
            itemId: res.data.id,
            sortOrder: i,
          });
          if (!photo.success) failedPhotos++;
        }
      }
      toast.success(item ? "Item updated" : "Item added");
      // The item saved either way; say which photos did not rather than
      // reporting a clean success over missing pictures.
      if (failedPhotos > 0) {
        toast.error(
          `${failedPhotos} ${failedPhotos === 1 ? "photo" : "photos"} could not be attached`
        );
      }
      onDone();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      // No panel of its own any more: it lives in a dialog, and a bordered
      // box inside a bordered box is one frame too many.
      className="flex flex-col gap-3"
    >
      {/* Category first, and on its own line. It decides which fields appear
          below it, what the price can be quoted in and what a good title
          looks like — so it is the question to answer first, not a control
          squeezed beside the title with a different weight to it. */}
      <Field className="gap-1">
        <FieldLabel htmlFor={`category-${item?.id ?? "new"}`} className="text-xs">
          Category
        </FieldLabel>
        <Select
          value={category}
          onValueChange={(v) => {
            const next = v as TripItemCategory;
            setCategory(next);
            // While creating, adopt the new category's usual unit. While
            // editing, keep whatever was chosen — unless the new category
            // cannot be priced that way at all, which is the one case where
            // leaving it alone would save nonsense (a fare per night).
            if (!item || !allowsPriceUnit(next, priceUnit)) {
              setPriceUnit(itemFields(next).defaultPriceUnit);
            }
          }}
        >
          <SelectTrigger
            id={`category-${item?.id ?? "new"}`}
            className="w-full data-[size=default]:h-11"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CATEGORIES.map(({ value, label }) => (
                <SelectItem key={value} value={value} className="py-2">
                  <span className="inline-flex items-center gap-2.5">
                    <CategoryIcon category={value} />
                    <span className="text-sm">{label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {fields.title ? (
        <Field className="gap-1" data-invalid={!!errors.title}>
          <FieldLabel htmlFor={`title-${item?.id ?? "new"}`} className="text-xs">
            Title
          </FieldLabel>
          <Input
            id={`title-${item?.id ?? "new"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={fields.titlePlaceholder}
            // `aria-required`, not `required`: the native bubble fired before
            // the form's own check and said "Please fill out this field" in
            // the browser's style, over the field, instead of the message
            // under it that every other error here uses.
            aria-required
            autoFocus
            aria-invalid={!!errors.title}
          />
          <FieldError>{errors.title}</FieldError>
        </Field>
      ) : (
        <Text variant="small">
          Saved as{" "}
          <span className="font-medium text-foreground">
            {deriveTitle(
              category,
              { fromCode, toCode, roundTrip },
              categoryMeta(category).label
            )}
          </span>{" "}
          — taken from the route.
        </Text>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field className={cn("gap-1", showEnd ? "" : "sm:col-span-2")}>
          <FieldLabel htmlFor={`date-${item?.id ?? "new"}`} className="text-xs">
            {fields.startLabel}
          </FieldLabel>
          <DateField
            id={`date-${item?.id ?? "new"}`}
            value={scheduledOn ?? ""}
            onChange={setScheduledOn}
          />
        </Field>
        {showEnd && (
          <Field className="gap-1" data-invalid={!!errors.endsOn}>
            <FieldLabel htmlFor={`ends-${item?.id ?? "new"}`} className="text-xs">
              {endDayLabel(fields, roundTrip)}{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <DateField
              id={`ends-${item?.id ?? "new"}`}
              value={endsOn ?? ""}
              onChange={setEndsOn}
              min={scheduledOn || undefined}
              placeholder="Not set"
              clearable
              aria-invalid={!!errors.endsOn}
            />
            <FieldError>{errors.endsOn}</FieldError>
          </Field>
        )}
        {fields.route && (
          <div className="grid grid-cols-2 gap-2.5 sm:col-span-2">
            <Field className="gap-1">
              <FieldLabel htmlFor={`from-${item?.id ?? "new"}`} className="text-xs">From</FieldLabel>
              <AirportPicker
                id={`from-${item?.id ?? "new"}`}
                value={fromCode ?? ""}
                onChange={setFromCode}
                placeholder="SJO or San José"
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel htmlFor={`to-${item?.id ?? "new"}`} className="text-xs">To</FieldLabel>
              <AirportPicker
                id={`to-${item?.id ?? "new"}`}
                value={toCode ?? ""}
                onChange={setToCode}
                placeholder="MCO or Orlando"
              />
            </Field>
          </div>
        )}

        {fields.roundTrip && (
          <label
            htmlFor={`rt-${item?.id ?? "new"}`}
            className="flex cursor-pointer items-center gap-2 self-end rounded-md border px-3 py-2 sm:col-span-2"
          >
            <Checkbox
              id={`rt-${item?.id ?? "new"}`}
              checked={roundTrip}
              onCheckedChange={(v) => setRoundTrip(v === true)}
            />
            <span className="text-xs">
              Round trip
              <span className="ml-1.5 text-muted-foreground">
                — one booking, both ways. The price covers the whole thing.
              </span>
            </span>
          </label>
        )}

        {/* A price, its ceiling and what it is quoted per are one question
            asked three ways. On three separate rows they read as three, and
            they were a third of the dialog's height. */}
        <div className="grid grid-cols-2 gap-2.5 sm:col-span-2 sm:grid-cols-[1fr_1fr_1.2fr]">
        <Field className="gap-1" data-invalid={!!errors.price}>
          <FieldLabel htmlFor={`price-${item?.id ?? "new"}`} className="text-xs">
            Price <span className="text-muted-foreground">(or low estimate)</span>
          </FieldLabel>
          <MoneyInput
            id={`price-${item?.id ?? "new"}`}
            value={price ?? ""}
            onChange={setPrice}
            currency={currency}
            placeholder="0.00"
            aria-invalid={!!errors.price}
          />
          <FieldError>{errors.price}</FieldError>
        </Field>
        <Field className="gap-1" data-invalid={!!errors.priceMax}>
          <FieldLabel htmlFor={`pricemax-${item?.id ?? "new"}`} className="text-xs">
            Up to <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <MoneyInput
            id={`pricemax-${item?.id ?? "new"}`}
            value={priceMax ?? ""}
            onChange={setPriceMax}
            currency={currency}
            placeholder="0.00"
            aria-invalid={!!errors.priceMax}
          />
          <FieldError>{errors.priceMax}</FieldError>
        </Field>
        <Field className="col-span-2 gap-1 sm:col-span-1">
          <FieldLabel htmlFor={`unit-${item?.id ?? "new"}`} className="text-xs">
            That price is
          </FieldLabel>
          <Select
            value={priceUnit}
            onValueChange={(v) => setPriceUnit(v as TripPriceUnit)}
          >
            <SelectTrigger id={`unit-${item?.id ?? "new"}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {priceUnitOptions(category, item?.priceUnit).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {PRICE_UNIT_LABELS[unit]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        </div>

        {/* Two optional URLs, side by side: as full-width rows they took as
            much of the dialog as the price did. A category with no video
            field leaves the link the whole row. */}
        <Field className={cn("gap-1", fields.video ? "" : "sm:col-span-2")}>
          <FieldLabel htmlFor={`link-${item?.id ?? "new"}`} className="text-xs">Link</FieldLabel>
          <Input
            id={`link-${item?.id ?? "new"}`}
            type="url"
            value={link ?? ""}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://booking.com/…"
          />
        </Field>
        {fields.video && (
        <Field className="gap-1">
          <FieldLabel htmlFor={`video-${item?.id ?? "new"}`} className="text-xs">
            Video
          </FieldLabel>
          <Input
            id={`video-${item?.id ?? "new"}`}
            type="url"
            value={videoUrl ?? ""}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube or Instagram link"
          />
        </Field>
        )}
      </div>

      {travellers.length > 1 && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {/* Who is on it and who pays for it are different questions, and
              answering only the second got both cases wrong: the festival all
              four are going to vanished off the two who are not paying for
              it, and a flight one person takes stayed on everybody's day. */}
          <TravellerChips
            label="Who's coming"
            travellers={travellers}
            selected={attendeeIds}
            onChange={setAttendeeIds}
            allLabel="Everyone"
            hint={
              attendeeIds.length === 0
                ? "On everybody's itinerary."
                : `Only on ${names(attendeeIds, travellers)}'s itinerary.`
            }
          />
          <TravellerChips
            label="Who pays for this"
            travellers={travellers}
            selected={payerIds}
            onChange={setPayerIds}
            allLabel="Everyone"
            hint={
              payerIds.length === 0
                ? "Divided the way the trip divides."
                : `Only ${names(payerIds, travellers)} — split equally between them.`
            }
          />
        </div>
      )}

      {/* The picker is hidden on a category that has nothing to photograph,
          but photos already attached still have to be reachable — an item
          re-categorised to Flight would otherwise keep them with no way to
          look at or remove them. */}
      {(fields.photos || shownPhotos.length > 0) && (
      <FieldSet className="gap-1">
        <FieldLegend variant="label" className="mb-1 text-xs">
          Photos
        </FieldLegend>
        {shownPhotos.length > 0 && (
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {shownPhotos.map((photo, i) => (
              <div
                key={photo.key}
                className="group relative aspect-square w-20 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt={`${title.trim() || "Item"} photo ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="secondary"
                  className="absolute right-1 top-1"
                  onClick={() => removePhoto(photo)}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
        {fields.photos && (
        <PhotoPicker
          variant="compact"
          folder={tripId}
          onPick={async ({ url, storagePath, source }) => {
            if (!item) {
              setPending((p) => [...p, { url, storagePath, source }]);
              return;
            }
            const res = await addTripPhotoAction(tripId, {
              url,
              storagePath,
              source,
              itemId: item.id,
              sortOrder: item.photos.length,
            });
            if (!res.success) toast.error(res.error);
          }}
        />
        )}
      </FieldSet>
      )}

      {fields.itinerary && item && (
        <div className="flex flex-col gap-1.5">
          {editingStops ? (
            <ItineraryEditor
              tripId={tripId}
              itemId={item.id}
              stops={item.stops}
              onDone={() => setEditingStops(false)}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditingStops(true)}
            >
              <ListOrdered />
              {item.stops.length > 0
                ? `Edit itinerary (${item.stops.length} days)`
                : "Add itinerary"}
            </Button>
          )}
        </div>
      )}

      <Field className="gap-1">
        <FieldLabel htmlFor={`notes-${item?.id ?? "new"}`} className="text-xs">Notes</FieldLabel>
        <Textarea
          id={`notes-${item?.id ?? "new"}`}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reservation reference, confirmation code, what to pack…"
          rows={2}
        />
      </Field>

      <div className="flex items-center justify-between gap-2">
        {/* Removing an item is something you decide once you are looking at
            it, which is exactly here. It used to live in a menu that only
            appeared on hover, and holding space for that menu is what kept
            every price off the card's edge. */}
        {item ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={isPending || deleting}
            onClick={handleDelete}
          >
            {deleting ? <Spinner /> : <Trash2 />}
            {deleting ? "Removing…" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : item ? "Save" : "Add item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
