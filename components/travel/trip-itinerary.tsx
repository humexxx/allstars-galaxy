"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ListOrdered,
  ExternalLink,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
} from "@/components/ui/select";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { EmptyState } from "@/components/ui/empty-state";

import {
} from "@/app/actions/travel";
import type {
  TripItemWithStops,
  TripWithRelations,
} from "@/types/travel";

import {
  dayGroupLabel,
  formatTripMoney,
  moneyRange,
  runsUntil,
} from "@/lib/travel/format";
import { ActivityVideo } from "@/components/travel/activity-video";
import { ItemItinerary } from "@/components/travel/item-itinerary";
import {
} from "@/lib/travel/item-fields";
import { itemCost, unitSuffix } from "@/lib/travel/pricing";
import { CategoryIcon, categoryMeta } from "@/components/travel/category";
import { ItemForm } from "@/components/travel/item-form";
import { readerCost, viewerItems, type ItineraryViewer } from "@/lib/travel/viewer";
export type { ItineraryViewer };

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      key === NO_DATE_KEY ? "Unscheduled" : dayGroupLabel(key, runsUntil(arr));
    return { key, label, items: arr, low, high };
  });
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
  /** Only what the selected traveller is part of; the whole plan otherwise. */
  const items = useMemo(() => viewerItems(trip.items, viewer), [trip.items, viewer]);
  const groups = useMemo(
    () => groupByDay(items, partySize, viewer),
    [items, partySize, viewer]
  );

  return (
    <Card>
      <CardHeader>
        {/* On a phone the whose-share badge goes under the heading rather
            than beside it: inline, a name like "Alejandra's share" pushed the
            row against Add item with nowhere left to go. */}
        <CardTitle className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="flex items-center gap-2">
            Itinerary
            {/* The count belongs with the thing it counts, not in the banner. */}
            {items.length > 0 && (
              <Badge variant="secondary" className="text-2xs font-normal">
                {items.length}
              </Badge>
            )}
          </span>
          {/* Every price below is one person's, and a reader who missed the
              click upstairs would otherwise read them as the trip's. */}
          {viewer && (
            <Badge variant="outline" className="text-2xs font-normal">
              {viewer.isYou ? "your share" : `${viewer.name}'s share`}
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-3.5" /> Add item
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 ">
        {groups.length === 0 && (
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
                  travellers={trip.members.map((m) => ({ id: m.id, name: m.name }))}
                />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>

      {/* One form, one place it appears — adding and editing are the same
          work, and having one expand the card while the other opened a
          dialog made them look like different things. */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to the itinerary</DialogTitle>
            <DialogDescription>
              A flight, a hotel, a cruise — anything with a date, a link or a price.
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            tripId={trip.id}
            defaultDate={trip.startDate}
            currency={trip.currency}
            travellers={trip.members.map((m) => ({ id: m.id, name: m.name }))}
            onDone={() => setAdding(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ItemRow({
  tripId,
  item,
  currency,
  partySize,
  viewer,
  travellers,
}: {
  tripId: string;
  item: TripItemWithStops;
  currency: string;
  /** How many people the per-person prices apply to. */
  partySize: number;
  viewer: ItineraryViewer | null;
  travellers: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const meta = categoryMeta(item.category);
  const cost = itemCost(item, partySize);
  // The row leads with whatever the day subtotal is adding up, or the two
  // disagree on screen and neither can be checked against the other.
  const mine = readerCost(item, partySize, viewer);

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
    // `=== false` on purpose: getSelection() is null in some webviews,
    // and `!undefined` would swallow every click on the row.
    if (window.getSelection()?.isCollapsed === false) return;
    setEditing(true);
  };

  return (
    <>
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
            // No hover state of its own: the row already lights up, and a
            // second one on the title reads as a link to somewhere else.
            className="min-w-0 cursor-pointer truncate text-left font-medium outline-none focus-visible:underline"
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
        {item.photos.length > 0 && (
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 pt-1">
            {item.photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square w-20 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? ""}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}
        {item.videoUrl && (
          <div className="pt-2">
            <ActivityVideo url={item.videoUrl} title={item.title} />
          </div>
        )}
      </div>
    </li>

    {/* In a dialog, not expanded in place. The form is long enough that
        opening it inline pushed every item below it off the screen, and the
        row you were editing left the viewport with them. */}
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>
            Change the details, the dates or the price.
          </DialogDescription>
        </DialogHeader>
        <ItemForm
          tripId={tripId}
          item={item}
          defaultDate={item.scheduledOn}
          currency={currency}
          travellers={travellers}
          onDone={() => setEditing(false)}
        />
      </DialogContent>
    </Dialog>
    </>
  );
}
