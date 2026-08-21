"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { moneyRange } from "@/lib/travel/format";
import { MarqueeText } from "./marquee-text";

import type { TripWithRelations } from "@/types/travel";
import { categoryMeta } from "./category";

import { readerCost, type ItineraryViewer } from "@/lib/travel/viewer";
import {
  addMonths,
  isoDay,
  layOutWeek,
  monthWeeks,
  occupiedRuns,
  parseDay,
  type CalendarItem,
} from "@/lib/travel/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Where the first bar sits, clear of the date, and how tall each lane is.
 *
 * A cell is then tall enough for its week's deepest stack plus a line for the
 * day's cost — without that last allowance the bars were drawn straight over
 * the figures. MIN_CELL keeps a quiet week from collapsing into a strip; a
 * month of thin bands does not read as a calendar.
 */
const LANE_TOP = 22;
const LANE_HEIGHT = 22;
const MIN_CELL = 64;

/** Static so Tailwind can see them; arbitrary values would not be generated. */
const COL_START = [
  "col-start-1", "col-start-2", "col-start-3", "col-start-4",
  "col-start-5", "col-start-6", "col-start-7",
];
const COL_SPAN = [
  "col-span-1", "col-span-2", "col-span-3", "col-span-4",
  "col-span-5", "col-span-6", "col-span-7",
];

/**
 * The trip laid out on the calendar it will actually happen on.
 *
 * The list view answers "what is the plan"; this one answers "what does the
 * month look like" — where the free days are, how long the cruise really runs,
 * whether two things collide.
 *
 * Runs are drawn as bars across the days they occupy rather than as a repeated
 * chip in each cell, because the length of the bar IS the information. A
 * return flight is deliberately two bars and not one: its second date is the
 * day it comes back, not a day it occupies.
 */
export function TripCalendar({
  trip,
  partySize = 1,
  viewer = null,
}: {
  trip: TripWithRelations;
  partySize?: number;
  viewer?: ItineraryViewer | null;
}) {
  const tripMonth = trip.startDate.slice(0, 7);
  const [month, setMonth] = useState(tripMonth);

  const items: CalendarItem[] = useMemo(
    () =>
      trip.items
        .filter((i) => i.scheduledOn)
        .map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          scheduledOn: i.scheduledOn,
          endsOn: i.endsOn,
        })),
    [trip.items]
  );

  const weeks = useMemo(() => monthWeeks(month), [month]);
  const byId = useMemo(() => new Map(trip.items.map((i) => [i.id, i])), [trip.items]);

  /**
   * What each item costs, on the item rather than on the day.
   *
   * The figure used to sit in the day cell, which meant a day with two
   * bookings showed one number belonging to neither. On the bar it is
   * unambiguous, and the day keeps the room the number was taking.
   */
  const costByItem = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of trip.items) {
      if (item.price === null) continue;
      const c = readerCost(item, partySize, viewer);
      if (c.high > 0) map.set(item.id, moneyRange(c.low, c.high, trip.currency));
    }
    return map;
  }, [trip.items, partySize, viewer, trip.currency]);

  const today = isoDay(new Date());
  const tripEnd = trip.endDate ?? trip.startDate;
  const inTrip = (day: string) => day >= trip.startDate && day <= tripEnd;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {format(parseDay(`${month}-01`), "MMMM yyyy")}
          {viewer && (
            <Badge variant="outline" className="text-2xs font-normal">
              {viewer.isYou ? "your share" : `${viewer.name}'s share`}
            </Badge>
          )}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-9 sm:size-8"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-9 sm:size-8"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {/* Wandering off into empty months is the whole point of the
                arrows; this is the way back without counting clicks. */}
            <Button
              size="sm"
              variant="outline"
              className="ml-1"
              disabled={month === tripMonth}
              onClick={() => setMonth(tripMonth)}
            >
              <MapPin className="mr-1 size-3.5" />
              Trip
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <Text key={d} className="truncate text-center text-2xs text-muted-foreground">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </Text>
          ))}
        </div>

        {weeks.map((week) => {
          const segments = layOutWeek(week, items);
          const lanes = segments.reduce((n, seg) => Math.max(n, seg.lane + 1), 0);
          const cellHeight = Math.max(
            MIN_CELL,
            LANE_TOP + lanes * LANE_HEIGHT + 6
          );
          return (
            <div key={week[0]} className="relative">
              <div className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const thisMonth = day.slice(0, 7) === month;
                  return (
                    <div
                      key={day}
                      // A computed layout, not a spacing choice — see the
                      // constants above.
                      style={{ minHeight: cellHeight }}
                      className={cn(
                        "flex flex-col rounded-md border p-1",
                        inTrip(day) ? "bg-card" : "bg-muted/30",
                        day === today && "ring-2 ring-primary/40"
                      )}
                    >
                      <Mono
                        className={cn(
                          "text-2xs tabular-nums",
                          !thisMonth && "text-muted-foreground/50",
                          thisMonth && inTrip(day) && "font-medium",
                          thisMonth && !inTrip(day) && "text-muted-foreground"
                        )}
                      >
                        {Number(day.slice(-2))}
                      </Mono>
                    </div>
                  );
                })}
              </div>

              {/* The bars ride over the day grid on a matching seven-column
                  track, which is the only way a run can cross a cell boundary
                  and read as one thing. */}
              <div
                className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-x-1 gap-y-0.5 px-1"
                style={{ top: LANE_TOP }}
              >
                {segments.map((seg) => {
                  const meta = categoryMeta(seg.item.category);
                  const full = byId.get(seg.item.id);
                  const runs = occupiedRuns(seg.item);
                  const price = costByItem.get(seg.item.id);
                  return (
                    <div
                      key={`${seg.item.id}-${seg.start}-${seg.lane}`}
                      style={{ gridRow: seg.lane + 1, height: LANE_HEIGHT - 4 }}
                      className={cn(
                        "group/bar pointer-events-auto flex min-w-0 items-center gap-1 overflow-hidden px-1",
                        meta.bar,
                        COL_START[seg.start],
                        COL_SPAN[seg.span - 1],
                        // Flat and flush where the run carries on into the
                        // next week, so the eye reads one journey rather than
                        // two bookings; inset by a hair where it really
                        // starts or ends, so the badge sits inside its day
                        // rather than hard against the cell's border.
                        seg.opensRun ? "ml-0.5 rounded-l-sm" : "rounded-l-none",
                        seg.closesRun ? "mr-0.5 rounded-r-sm" : "rounded-r-none"
                      )}
                      title={`${seg.item.title}${runs.length > 1 ? " — out and back" : ""}${
                        full?.endsOn && full.endsOn !== full.scheduledOn
                          ? ` · ${full.scheduledOn} → ${full.endsOn}`
                          : ""
                      }`}
                    >
                      <meta.Icon className="hidden size-3 shrink-0 sm:block" />
                      {seg.opensRun && (
                        // Title and price are one label, not two boxes
                        // competing for a bar that can be a single day wide.
                        // Pinned to the right, the price ate the title
                        // whole — a flight read "$600 – $" and never said
                        // where it went. As one string the wide bars show
                        // everything and the narrow ones reveal it on hover.
                        <MarqueeText className="hidden text-2xs font-medium leading-none sm:block">
                          {price ? `${seg.item.title} · ${price}` : seg.item.title}
                        </MarqueeText>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
