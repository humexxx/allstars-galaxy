"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Anchor,
  Bed,
  Bus,
  ListOrdered,
  ExternalLink,
  Pencil,
  Plane,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { formatTripMoney } from "@/lib/travel/format";
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
import { moneyRange } from "@/components/travel/traveller-bar";
import { MoneyInput } from "@/components/ui/money-input";
import { ItineraryEditor } from "@/components/travel/itinerary-editor";
import { Badge } from "@/components/ui/badge";

type CategoryMeta = {
  value: TripItemCategory;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Tint for the icon chip: a wash plus a foreground that holds up in both
   *  themes. Deliberately NOT `--chart-1..5` — that palette has five slots and
   *  must never be cycled, and there are eight categories here. */
  tint: string;
};

/**
 * Colour is the second channel, never the only one.
 *
 * The icon's shape is what actually says "flight"; the tint makes a long list
 * scannable and lets a row be recognised out of the corner of an eye. Anyone
 * who cannot separate two of these hues still reads a plane and a bed.
 */
export const CATEGORIES: CategoryMeta[] = [
  { value: "lodging", label: "Hotel", Icon: Bed,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "flight", label: "Flight", Icon: Plane,
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { value: "cruise", label: "Cruise", Icon: Anchor,
    tint: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  { value: "transport", label: "Transport", Icon: Bus,
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { value: "food", label: "Food", Icon: Utensils,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  // Lime, not the obvious emerald: emerald sits 22° from teal, and measured
  // ΔEok 0.056 against it — visible, but the tightest pair on the wheel. Lime
  // drops into the wide gap between amber and teal and takes the worst pair to
  // 0.137. The 700 step rather than 600 because lime is intrinsically light:
  // 600 clears non-text contrast at only 3.06:1, 700 at 4.96:1.
  { value: "activity", label: "Activity", Icon: Sparkles,
    tint: "bg-lime-500/10 text-lime-700 dark:text-lime-400" },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag,
    tint: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400" },
  // Neutral on purpose: "other" is the absence of a category, and giving it a
  // hue of its own would make it look like one more kind of thing.
  { value: "other", label: "Other", Icon: Tag,
    tint: "bg-muted text-muted-foreground" },
];

const PRICE_UNIT_LABELS: Record<TripPriceUnit, string> = {
  total: "a total",
  per_night: "per night",
  per_person: "per person",
};

function categoryMeta(c: TripItemCategory): CategoryMeta {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** One chip, so the dropdown and the rows can never drift apart. */
function CategoryIcon({
  category,
  className,
}: {
  category: TripItemCategory;
  className?: string;
}) {
  const { Icon, tint } = categoryMeta(category);
  return (
    <span
      className={cn("grid size-7 shrink-0 place-items-center rounded-md", tint, className)}
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * Width of a row's trailing controls, and of the spacer that stands in for
 * them in the day header.
 *
 * The two must agree or the money does not line up: the buttons hold their
 * space even while invisible, so the item prices sat inset while the day
 * subtotal ran to the card's edge. Declaring the width once is what keeps the
 * header honest — w-20 clears two h-9 touch targets, sm:w-16 two h-7 ones.
 */
const ACTIONS_WIDTH = "w-20 sm:w-16";

const NO_DATE_KEY = "__no_date__";

/**
 * The traveller the itinerary is costed for, or null for the whole trip.
 *
 * `lines` is what `splitTrip` worked out this person owes per item, keyed by
 * item id. Passing the already-split figures down rather than re-deriving them
 * here is what keeps the day subtotals and the banner's pill agreeing.
 */
export type ItineraryViewer = {
  name: string;
  isYou: boolean;
  lines: Map<string, { low: number; high: number }>;
};

/** What one item costs the current reader: their share, or the whole thing. */
function readerCost(
  item: TripItemWithStops,
  partySize: number,
  viewer: ItineraryViewer | null
): { low: number; high: number } {
  if (viewer) return viewer.lines.get(item.id) ?? { low: 0, high: 0 };
  const cost = itemCost(item, partySize);
  return { low: cost.low, high: cost.high };
}

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="mr-1 size-3.5" /> : <Plus className="mr-1 size-3.5" />}
          {adding ? "Cancel" : "Add item"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {adding && (
          <ItemForm
            tripId={trip.id}
            defaultDate={trip.startDate}
            currency={trip.currency}
            onDone={() => setAdding(false)}
          />
        )}

        {groups.length === 0 && !adding && (
          <Text
            variant="muted"
            className="rounded-md border border-dashed p-6 text-center"
          >
            No items yet. Add lodging, transport, activities or anything with a link or price.
          </Text>
        )}

        {groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <div className="flex items-end gap-3 border-b pb-1">
              <div className="flex min-w-0 flex-1 items-end justify-between gap-2">
                <Heading level="h6" as="h3">{group.label}</Heading>
                {group.high > 0 && (
                  <Mono className="shrink-0 text-xs text-muted-foreground">
                    {moneyRange(group.low, group.high, trip.currency)}
                  </Mono>
                )}
              </div>
              {/* Stands where each row's buttons stand, so this subtotal lands
                  in the same column as the prices it adds up. */}
              <span className={cn("shrink-0", ACTIONS_WIDTH)} aria-hidden />
            </div>
            <ul className="divide-y">
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
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = categoryMeta(item.category);
  const cost = itemCost(item, partySize);
  // The row leads with whatever the day subtotal is adding up, or the two
  // disagree on screen and neither can be checked against the other.
  const mine = readerCost(item, partySize, viewer);

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTripItemAction(tripId, item.id);
      if (res.success) {
        toast.success("Item removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

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

  return (
    <li className="group flex items-start gap-3 py-3">
      <CategoryIcon category={item.category} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <Text weight="medium" className="truncate">{item.title}</Text>
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
      {/* Always visible on touch (no hover); hover/focus-revealed on desktop.
          Fixed width even when invisible — see ACTIONS_WIDTH. */}
      <div
        className={cn(
          "flex shrink-0 justify-end gap-0.5 transition-opacity",
          "sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100",
          ACTIONS_WIDTH
        )}
      >
        <Button
          size="icon"
          variant="ghost"
          className="size-9 sm:size-7"
          onClick={() => setEditing(true)}
          aria-label="Edit item"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 text-destructive hover:text-destructive sm:size-7"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Delete item"
        >
          <Trash2 className="size-3.5" />
        </Button>
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
        "space-y-3 rounded-md border bg-muted/30 p-3",
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
        <div className="space-y-1.5">
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

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : item ? "Save" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
