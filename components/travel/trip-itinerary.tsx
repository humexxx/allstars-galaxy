"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ListOrdered,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

import {
  addTripItemAction,
  deleteTripItemAction,
  updateTripItemAction,
} from "@/app/actions/travel";
import type {
  TripItemCategory,
  TripPriceUnit,
  TripItemWithStops,
  TripWithRelations,
} from "@/types/travel";

import { formatTripMoney, moneyRange } from "@/lib/travel/format";
import { ActivityVideo } from "@/components/travel/activity-video";
import { ItemItinerary } from "@/components/travel/item-itinerary";
import { Checkbox } from "@/components/ui/checkbox";
import {
  allowsPriceUnit,
  deriveTitle,
  endDayLabel,
  itemFields,
  priceUnitOptions,
  showsEndDay,
} from "@/lib/travel/item-fields";
import { AirportPicker } from "@/components/travel/airport-picker";
import { itemCost, unitSuffix } from "@/lib/travel/pricing";
import { CATEGORIES, CategoryIcon, categoryMeta } from "@/components/travel/category";
import { readerCost, type ItineraryViewer } from "@/lib/travel/viewer";
export type { ItineraryViewer };

import { MoneyInput } from "@/components/ui/money-input";
import { ItineraryEditor } from "@/components/travel/itinerary-editor";
import { Badge } from "@/components/ui/badge";

const PRICE_UNIT_LABELS: Record<TripPriceUnit, string> = {
  total: "a total",
  per_night: "per night",
  per_person: "per person",
};

const NO_DATE_KEY = "__no_date__";

function groupByDay(
  items: TripItemWithStops[],
  partySize: number,
  viewer: ItineraryViewer | null
): Array<{
  key: string;
  label: string;
  items: TripItemWithStops[];
  low: number;
  high: number;
}> {
  const groups = new Map<string, TripItemWithStops[]>();
  for (const item of items) {
    const key = item.scheduledOn ?? NO_DATE_KEY;
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }
  // Real dates first (ascending), unscheduled bucket last.
  const dateKeys = [...groups.keys()].filter((k) => k !== NO_DATE_KEY).sort();
  if (groups.has(NO_DATE_KEY)) dateKeys.push(NO_DATE_KEY);
  return dateKeys.map((key) => {
    const arr = groups.get(key)!;
    // Both ends, summed from the same figures the rows show, so the subtotal
    // is always the visible arithmetic. It used to take `tripCost(...).low`
    // and report a $600–$800 flight plus a $200–$400 hotel as a flat $800.
    let low = 0;
    let high = 0;
    for (const item of arr) {
      if (item.price === null) continue;
      const cost = readerCost(item, partySize, viewer);
      low += cost.low;
      high += cost.high;
    }
    const label =
      key === NO_DATE_KEY
        ? "Unscheduled"
        : format(parseDate(key), "EEEE, MMM d");
    return { key, label, items: arr, low, high };
  });
}

function parseDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type TripItineraryProps = {
  trip: TripWithRelations;
  /** Travellers the per-person prices apply to. Defaults to one until the
   *  trip has members — a plan for nobody is not a thing. */
  partySize?: number;
  /** Whose money the figures are in. Null shows what the trip costs. */
  viewer?: ItineraryViewer | null;
};

export function TripItinerary({
  trip,
  partySize = 1,
  viewer = null,
}: TripItineraryProps) {
  const [adding, setAdding] = useState(false);
  const groups = useMemo(
    () => groupByDay(trip.items, partySize, viewer),
    [trip.items, partySize, viewer]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Itinerary
          {/* The count belongs with the thing it counts, not in the banner. */}
          {trip.items.length > 0 && (
            <Badge variant="secondary" className="text-2xs font-normal">
              {trip.items.length}
            </Badge>
          )}
          {/* Every price below is one person's, and a reader who missed the
              click upstairs would otherwise read them as the trip's. */}
          {viewer && (
            <Badge variant="outline" className="text-2xs font-normal">
              {viewer.isYou ? "your share" : `${viewer.name}'s share`}
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            {adding ? <X className="mr-1 size-3.5" /> : <Plus className="mr-1 size-3.5" />}
            {adding ? "Cancel" : "Add item"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 ">
        {adding && (
          <ItemForm
            tripId={trip.id}
            defaultDate={trip.startDate}
            currency={trip.currency}
            onDone={() => setAdding(false)}
          />
        )}

        {groups.length === 0 && !adding && (
          <EmptyState
            icon={ListOrdered}
            title="Nothing planned yet"
            description="Add lodging, transport, activities — anything with a link or a price."
            className="border-dashed"
          />
        )}

        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2 ">
            {/* Nothing is reserved at the right of a row any more — the row
                itself is the control — so the subtotal and the prices it adds
                up share one edge with no spacer to keep in step. */}
            <div className="flex items-end justify-between gap-2 border-b pb-1">
              <Heading level="h6" as="h3">{group.label}</Heading>
              {group.high > 0 && (
                <Mono className="shrink-0 text-xs text-muted-foreground">
                  {moneyRange(group.low, group.high, trip.currency)}
                </Mono>
              )}
            </div>
            <ul className="-mx-2 divide-y">
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  tripId={trip.id}
                  item={item}
                  currency={trip.currency}
                  partySize={partySize}
                  viewer={viewer}
                />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function ItemRow({
  tripId,
  item,
  currency,
  partySize,
  viewer,
}: {
  tripId: string;
  item: TripItemWithStops;
  currency: string;
  /** How many people the per-person prices apply to. */
  partySize: number;
  viewer: ItineraryViewer | null;
}) {
  const [editing, setEditing] = useState(false);
  const meta = categoryMeta(item.category);
  const cost = itemCost(item, partySize);
  // The row leads with whatever the day subtotal is adding up, or the two
  // disagree on screen and neither can be checked against the other.
  const mine = readerCost(item, partySize, viewer);

  if (editing) {
    return (
      <li className="py-3">
        <ItemForm
          tripId={tripId}
          item={item}
          defaultDate={item.scheduledOn}
          currency={currency}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  /**
   * The row is the target, the way the payments list is.
   *
   * Not a `<button>`: the row holds a link, a disclosure and sometimes a video
   * embed, and nesting those inside a button is invalid and unusable with a
   * screen reader. So the container listens, and steps aside for anything
   * that handles its own clicks — and for a click that ends a text selection,
   * which is a read, not a press.
   */
  const openEditor = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, textarea, [role="button"], iframe')) return;
    if (!window.getSelection()?.isCollapsed) return;
    setEditing(true);
  };

  return (
    <li
      // Padded, not just spaced: the row is a target now, and a hover
      // tint that stops at the text reads as a highlight rather than a row.
      className="group relative flex cursor-pointer items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted/40"
      onClick={openEditor}
    >
      <CategoryIcon category={item.category} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          {/* The keyboard's way in, since a container cannot be the button. */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-w-0 cursor-pointer truncate text-left font-medium outline-none hover:underline focus-visible:underline"
          >
            {item.title}
          </button>
          {item.price && (
            <span className="shrink-0 text-right">
              <Mono className="block whitespace-nowrap text-xs font-medium">
                {moneyRange(mine.low, mine.high, currency)}
              </Mono>
              {viewer ? (
                // Their share leads, but the booking price is what you would
                // actually see on the hotel's site, so it stays in view.
                <Mono className="block text-2xs text-muted-foreground">
                  of {moneyRange(cost.low, cost.high, currency)}
                </Mono>
              ) : (
                <>
                  {/* Show the arithmetic. A hotel that reads $400 when you
                      typed $200 looks wrong until you can see the x2. */}
                  {cost.times > 1 && (
                    <Mono className="block whitespace-nowrap text-2xs text-muted-foreground">
                      {formatTripMoney(cost.unitLow ?? 0, currency)}
                      {cost.unitHigh !== null && cost.unitHigh > (cost.unitLow ?? 0) && (
                        <>–{formatTripMoney(cost.unitHigh, currency)}</>
                      )}{" "}
                      {unitSuffix(item.priceUnit)} × {cost.times}
                    </Mono>
                  )}
                  {cost.times === 1 && item.priceUnit !== "total" && (
                    <Mono className="block text-2xs text-muted-foreground">
                      {unitSuffix(item.priceUnit)}
                    </Mono>
                  )}
                </>
              )}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="capitalize">{meta.label}</span>
          {(item.fromCode || item.toCode) && (
            <Mono className="text-2xs font-medium">
              {item.fromCode ?? "?"}
              {/* A double arrow says "and back" faster than the words do. */}
              <span className="mx-1">{item.roundTrip ? "⇄" : "→"}</span>
              {item.toCode ?? "?"}
            </Mono>
          )}
          {item.endsOn && item.scheduledOn && item.endsOn !== item.scheduledOn && (
            <span>
              {item.roundTrip ? "back " : "through "}
              {format(new Date(`${item.endsOn}T00:00:00`), "d MMM")}
            </span>
          )}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="size-3" /> Link
            </a>
          )}
        </div>
        {item.notes && (
          <Text variant="small" className="line-clamp-2">{item.notes}</Text>
        )}
        {item.stops && item.stops.length > 0 && (
          <ItemItinerary stops={item.stops} />
        )}
        {item.videoUrl && (
          <div className="pt-2">
            <ActivityVideo url={item.videoUrl} title={item.title} />
          </div>
        )}
      </div>
    </li>
  );
}

function ItemForm({
  tripId,
  item,
  defaultDate,
  currency,
  onDone,
}: {
  tripId: string;
  item?: TripItemWithStops;
  defaultDate?: string | null;
  /** Drives the symbol shown inside the amount fields. */
  currency: string;
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
  const [notes, setNotes] = useState(item?.notes ?? "");

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
      };
      const res = item
        ? await updateTripItemAction(tripId, { id: item.id, ...payload })
        : await addTripItemAction(tripId, payload);
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
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-muted/30 p-3",
        !item && "border-primary/30"
      )}
    >
      <div
        className={cn(
          "grid gap-3",
          fields.title ? "sm:grid-cols-[2fr_1fr]" : "sm:grid-cols-1"
        )}
      >
        {fields.title && (
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`title-${item?.id ?? "new"}`} className="text-xs">Title</FieldLabel>
            <Input
              id={`title-${item?.id ?? "new"}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Check-in at Hotel Bairro Alto"
              required
              autoFocus
            />
          </Field>
        )}
        <Field className="gap-1.5">
          <FieldLabel className="text-xs">Category</FieldLabel>
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
            {/* Taller than the default h-9: the trigger carries an icon chip
                now, and eight tinted options are worth reading at a glance. */}
            <SelectTrigger className="w-full data-[size=default]:h-11">
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
          {!fields.title && (
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
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`date-${item?.id ?? "new"}`} className="text-xs">
            {fields.startLabel}
          </FieldLabel>
          <Input
            id={`date-${item?.id ?? "new"}`}
            type="date"
            value={scheduledOn ?? ""}
            onChange={(e) => setScheduledOn(e.target.value)}
          />
        </Field>
        {showEnd && (
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`ends-${item?.id ?? "new"}`} className="text-xs">
              {endDayLabel(fields, roundTrip)}{" "}
              <span className="text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id={`ends-${item?.id ?? "new"}`}
              type="date"
              value={endsOn ?? ""}
              min={scheduledOn || undefined}
              onChange={(e) => setEndsOn(e.target.value)}
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
