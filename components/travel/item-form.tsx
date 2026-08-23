"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ListOrdered, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Field, FieldLabel } from "@/components/ui/field";
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
  const router = useRouter();
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

  /** Saved photos and picked-but-unsaved ones, shown as one strip. */
  const shownPhotos = [
    ...(item?.photos ?? []).map((p) => ({ key: p.id, url: p.url, id: p.id })),
    ...pending.map((p, i) => ({ key: `pending-${i}`, url: p.url, id: null })),
  ];

  const removePhoto = (photo: { id: string | null; url: string }) => {
    if (!photo.id) {
      setPending((p) => p.filter((x) => x.url !== photo.url));
      return;
    }
    startTransition(async () => {
      const res = await deleteTripPhotoAction(tripId, photo.id!);
      if (res.success) router.refresh();
      else toast.error(res.error);
    });
  };

  const handleDelete = () => {
    if (!item) return;
    startDelete(async () => {
      const res = await deleteTripItemAction(tripId, item.id);
      if (res.success) {
        toast.success("Item removed");
        router.refresh();
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
    if (!effectiveTitle) {
      toast.error("Item needs a title");
      return;
    }
    const money = /^\d+(\.\d{1,2})?$/;
    if (price && !money.test(price)) {
      toast.error("Price must be a non-negative number with up to 2 decimals");
      return;
    }
    if (priceMax && !money.test(priceMax)) {
      toast.error("Max price must be a non-negative number with up to 2 decimals");
      return;
    }
    // A range that runs backwards is a typo, and silently storing it would
    // make the trip total nonsense.
    if (price && priceMax && parseFloat(priceMax) < parseFloat(price)) {
      toast.error("Max price cannot be below the price");
      return;
    }
    if (endsOn && scheduledOn && endsOn < scheduledOn) {
      toast.error("End day cannot be before the start day");
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
        endsOn: endsOn || null,
        videoUrl: videoUrl.trim() || null,
        notes: notes.trim() || null,
        payerIds,
      };
      const res = item
        ? await updateTripItemAction(tripId, { id: item.id, ...payload })
        : await addTripItemAction(tripId, payload);
      if (res.success && !item && res.data && pending.length > 0) {
        // Sequential on purpose: sortOrder is the order they were picked in,
        // and firing them together would race for it.
        for (let i = 0; i < pending.length; i++) {
          await addTripPhotoAction(tripId, {
            ...pending[i],
            itemId: res.data.id,
            sortOrder: i,
          });
        }
      }
      if (res.success) {
        toast.success(item ? "Item updated" : "Item added");
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
      // No panel of its own any more: it lives in a dialog, and a bordered
      // box inside a bordered box is one frame too many.
      className="flex flex-col gap-4"
    >
      {/* Category first, and on its own line. It decides which fields appear
          below it, what the price can be quoted in and what a good title
          looks like — so it is the question to answer first, not a control
          squeezed beside the title with a different weight to it. */}
      <Field className="gap-1.5">
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
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`title-${item?.id ?? "new"}`} className="text-xs">
            Title
          </FieldLabel>
          <Input
            id={`title-${item?.id ?? "new"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={fields.titlePlaceholder}
            required
            autoFocus
          />
        </Field>
      ) : (
        <Text variant="small" className="text-muted-foreground">
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="gap-1.5">
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
          <Field className="gap-1.5">
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
            />
          </Field>
        )}
        {fields.route && (
          <>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`from-${item?.id ?? "new"}`} className="text-xs">From</FieldLabel>
              <AirportPicker
                id={`from-${item?.id ?? "new"}`}
                value={fromCode ?? ""}
                onChange={setFromCode}
                placeholder="SJO or San José"
              />
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`to-${item?.id ?? "new"}`} className="text-xs">To</FieldLabel>
              <AirportPicker
                id={`to-${item?.id ?? "new"}`}
                value={toCode ?? ""}
                onChange={setToCode}
                placeholder="MCO or Orlando"
              />
            </Field>
          </>
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

        {/* A price and its upper bound are one question asked twice; split
            across rows by the parent grid they read as two. */}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`price-${item?.id ?? "new"}`} className="text-xs">
            Price <span className="text-muted-foreground">(or low estimate)</span>
          </FieldLabel>
          <MoneyInput
            id={`price-${item?.id ?? "new"}`}
            value={price ?? ""}
            onChange={setPrice}
            currency={currency}
            placeholder="0.00"
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`pricemax-${item?.id ?? "new"}`} className="text-xs">
            Up to <span className="text-muted-foreground">(optional)</span>
          </FieldLabel>
          <MoneyInput
            id={`pricemax-${item?.id ?? "new"}`}
            value={priceMax ?? ""}
            onChange={setPriceMax}
            currency={currency}
            placeholder="0.00"
          />
        </Field>
        </div>

        <Field className="gap-1.5 sm:col-span-2">
          <FieldLabel className="text-xs">That price is</FieldLabel>
          <Select
            value={priceUnit}
            onValueChange={(v) => setPriceUnit(v as TripPriceUnit)}
          >
            <SelectTrigger className="w-full">
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
        <Field className="gap-1.5 sm:col-span-2">
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
        <Field className="gap-1.5 sm:col-span-2">
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
        <Field className="gap-1.5">
          <FieldLabel className="text-xs">Who pays for this</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {/* "Everyone" is the absence of a choice, not a choice of its
                own — an empty list is what the split already means by
                "however the trip divides". */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-active={payerIds.length === 0}
              className="h-8 rounded-full px-3 text-xs data-[active=true]:border-foreground/30 data-[active=true]:bg-foreground/5"
              onClick={() => setPayerIds([])}
            >
              Everyone
            </Button>
            {travellers.map((t) => {
              const on = payerIds.includes(t.id);
              return (
                <Button
                  key={t.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  data-active={on}
                  className="h-8 rounded-full px-3 text-xs data-[active=true]:border-foreground/30 data-[active=true]:bg-foreground/5"
                  onClick={() =>
                    setPayerIds((cur) =>
                      on ? cur.filter((id) => id !== t.id) : [...cur, t.id]
                    )
                  }
                >
                  {t.name}
                </Button>
              );
            })}
          </div>
          <Text variant="small" className="text-muted-foreground">
            {payerIds.length === 0
              ? "Divided the way the trip divides."
              : `Only ${payerIds
                  .map((id) => travellers.find((t) => t.id === id)?.name ?? "?")
                  .join(" and ")} — split equally between them.`}
          </Text>
        </Field>
      )}

      <Field className="gap-1.5">
        <FieldLabel className="text-xs">Photos</FieldLabel>
        {shownPhotos.length > 0 && (
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {shownPhotos.map((photo) => (
              <div
                key={photo.key}
                className="group relative aspect-square w-20 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 size-7 sm:size-6"
                  onClick={() => removePhoto(photo)}
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
            if (res.success) router.refresh();
            else toast.error(res.error);
          }}
        />
      </Field>

      {fields.itinerary && item && (
        <div className="flex flex-col gap-1.5 ">
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
              <ListOrdered className="size-4" />
              {item.stops.length > 0
                ? `Edit itinerary (${item.stops.length} days)`
                : "Add itinerary"}
            </Button>
          )}
        </div>
      )}

      <Field className="gap-1.5">
        <FieldLabel htmlFor={`notes-${item?.id ?? "new"}`} className="text-xs">Notes</FieldLabel>
        <Textarea
          id={`notes-${item?.id ?? "new"}`}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reservation reference, confirmation code, who's coming…"
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
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isPending || deleting}
            onClick={handleDelete}
          >
            <Trash2 className="mr-1 size-3.5" />
            {deleting ? "Removing…" : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : item ? "Save" : "Add item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
