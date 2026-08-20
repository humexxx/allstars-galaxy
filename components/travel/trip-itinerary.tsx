"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Anchor,
  Bed,
  Bus,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
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
import { endDayLabel, itemFields, showsEndDay } from "@/lib/travel/item-fields";
import { AirportPicker } from "@/components/travel/airport-picker";
import { itemCost, tripCost, unitSuffix } from "@/lib/travel/pricing";

const CATEGORIES: { value: TripItemCategory; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "lodging", label: "Hotel", Icon: Bed },
  { value: "flight", label: "Flight", Icon: Plane },
  { value: "cruise", label: "Cruise", Icon: Anchor },
  { value: "transport", label: "Transport", Icon: Bus },
  { value: "food", label: "Food", Icon: Utensils },
  { value: "activity", label: "Activity", Icon: Sparkles },
  { value: "shopping", label: "Shopping", Icon: ShoppingBag },
  { value: "other", label: "Other", Icon: Tag },
];

function categoryMeta(c: TripItemCategory) {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];
}

const NO_DATE_KEY = "__no_date__";

function groupByDay(
  items: TripItemWithStops[],
  partySize: number
): Array<{ key: string; label: string; items: TripItemWithStops[]; total: number }> {
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
    const total = tripCost(arr, partySize).low;
    const label =
      key === NO_DATE_KEY
        ? "Unscheduled"
        : format(parseDate(key), "EEEE, MMM d");
    return { key, label, items: arr, total };
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
};

export function TripItinerary({ trip, partySize = 1 }: TripItineraryProps) {
  const [adding, setAdding] = useState(false);
  const groups = useMemo(
    () => groupByDay(trip.items, partySize),
    [trip.items, partySize]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Itinerary</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add item"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {adding && (
          <ItemForm
            tripId={trip.id}
            defaultDate={trip.startDate}
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
            <div className="flex items-end justify-between border-b pb-1">
              <Heading level="h6" as="h3">{group.label}</Heading>
              {group.total > 0 && (
                <Mono className="text-xs text-muted-foreground">
                  {formatTripMoney(group.total, trip.currency)}
                </Mono>
              )}
            </div>
            <ul className="divide-y">
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  tripId={trip.id}
                  item={item}
                  currency={trip.currency}
                  partySize={partySize}
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
}: {
  tripId: string;
  item: TripItemWithStops;
  currency: string;
  /** How many people the per-person prices apply to. */
  partySize: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = categoryMeta(item.category);
  const cost = itemCost(item, partySize);
  const Icon = meta.Icon;

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
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 py-3">
      <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <Text weight="medium" className="truncate">{item.title}</Text>
          {item.price && (
            <span className="shrink-0 text-right">
              <Mono className="block text-xs font-medium">
                {formatTripMoney(cost.low, currency)}
                {cost.ranged && (
                  <> – {formatTripMoney(cost.high, currency)}</>
                )}
              </Mono>
              {/* Show the arithmetic. A hotel that reads $400 when you typed
                  $200 looks wrong until you can see the x2 that made it. */}
              {cost.times > 1 && (
                <Mono className="block text-2xs text-muted-foreground">
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
              <ExternalLink className="h-3 w-3" /> Link
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
      {/* Always visible on touch (no hover); hover/focus-revealed on desktop. */}
      <div className="flex shrink-0 gap-0.5 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 sm:h-7 sm:w-7"
          onClick={() => setEditing(true)}
          aria-label="Edit item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-destructive hover:text-destructive sm:h-7 sm:w-7"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Delete item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function ItemForm({
  tripId,
  item,
  defaultDate,
  onDone,
}: {
  tripId: string;
  item?: TripItemWithStops;
  defaultDate?: string | null;
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
  const [priceUnit, setPriceUnit] = useState<TripPriceUnit>(
    item?.priceUnit ?? itemFields(item?.category ?? "activity").defaultPriceUnit
  );

  const fields = itemFields(category);
  const showEnd = showsEndDay(fields, roundTrip);
  const [videoUrl, setVideoUrl] = useState(item?.videoUrl ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
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
        title: title.trim(),
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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`title-${item?.id ?? "new"}`} className="text-xs">Title</Label>
          <Input
            id={`title-${item?.id ?? "new"}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Check-in at Hotel Bairro Alto"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => {
              const next = v as TripItemCategory;
              setCategory(next);
              // Adopt the new category's usual unit only while creating —
              // rewriting a saved choice behind the user's back is worse than
              // making them set it once.
              if (!item) setPriceUnit(itemFields(next).defaultPriceUnit);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(({ value, label, Icon }) => (
                <SelectItem key={value} value={value}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`date-${item?.id ?? "new"}`} className="text-xs">
            {fields.startLabel}
          </Label>
          <Input
            id={`date-${item?.id ?? "new"}`}
            type="date"
            value={scheduledOn ?? ""}
            onChange={(e) => setScheduledOn(e.target.value)}
          />
        </div>
        {showEnd && (
          <div className="space-y-1.5">
            <Label htmlFor={`ends-${item?.id ?? "new"}`} className="text-xs">
              {endDayLabel(fields, roundTrip)}{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`ends-${item?.id ?? "new"}`}
              type="date"
              value={endsOn ?? ""}
              min={scheduledOn || undefined}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          </div>
        )}
        {fields.route && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={`from-${item?.id ?? "new"}`} className="text-xs">From</Label>
              <AirportPicker
                id={`from-${item?.id ?? "new"}`}
                value={fromCode ?? ""}
                onChange={setFromCode}
                placeholder="SJO or San José"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`to-${item?.id ?? "new"}`} className="text-xs">To</Label>
              <AirportPicker
                id={`to-${item?.id ?? "new"}`}
                value={toCode ?? ""}
                onChange={setToCode}
                placeholder="MCO or Orlando"
              />
            </div>
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

        <div className="space-y-1.5">
          <Label htmlFor={`price-${item?.id ?? "new"}`} className="text-xs">
            Price <span className="text-muted-foreground">(or low estimate)</span>
          </Label>
          <Input
            id={`price-${item?.id ?? "new"}`}
            inputMode="decimal"
            value={price ?? ""}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`pricemax-${item?.id ?? "new"}`} className="text-xs">
            Up to <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`pricemax-${item?.id ?? "new"}`}
            inputMode="decimal"
            value={priceMax ?? ""}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="600.00"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">That price is</Label>
          <Select
            value={priceUnit}
            onValueChange={(v) => setPriceUnit(v as TripPriceUnit)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">a total</SelectItem>
              <SelectItem value="per_night">per night</SelectItem>
              <SelectItem value="per_person">per person</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`link-${item?.id ?? "new"}`} className="text-xs">Link</Label>
          <Input
            id={`link-${item?.id ?? "new"}`}
            type="url"
            value={link ?? ""}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://booking.com/…"
          />
        </div>
        {fields.video && (
        <div className="space-y-1.5">
          <Label htmlFor={`video-${item?.id ?? "new"}`} className="text-xs">
            Video
          </Label>
          <Input
            id={`video-${item?.id ?? "new"}`}
            type="url"
            value={videoUrl ?? ""}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube or Instagram link"
          />
        </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${item?.id ?? "new"}`} className="text-xs">Notes</Label>
        <Textarea
          id={`notes-${item?.id ?? "new"}`}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reservation reference, confirmation code, who's coming…"
          rows={2}
        />
      </div>

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
