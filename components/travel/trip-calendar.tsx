"use client";

import { useMemo } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { TripItemWithStops, TripWithRelations } from "@/types/travel";
import { CategoryIcon, categoryMeta } from "./category";
import { readerCost, type ItineraryViewer } from "@/lib/travel/viewer";
import { moneyRange } from "./traveller-bar";

/** Days are compared as YYYY-MM-DD strings — no timezone anywhere near them. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The weeks to draw: every month the trip touches, padded out to whole weeks.
 *
 * Padding matters more than it sounds — a trip that starts on a Friday would
 * otherwise open mid-row, and the eye reads the first cell as Monday.
 */
function buildWeeks(from: string, to: string): string[][] {
  const start = parseDay(from);
  const end = parseDay(to);

  // Whole weeks around the trip, NOT whole months. A ten-day trip in the
  // middle of January was drawing two empty weeks above it and the whole of
  // February below — pages of nothing, to place ten days.
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: string[][] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(isoDay(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * The trip laid out on the calendar it will actually happen on.
 *
 * The list view answers "what is the plan"; this one answers "what does the
 * week look like" — where the free days are, how long the cruise really runs,
 * whether two things collide. An item occupies every day it spans, not just
 * the day it starts, which is the whole reason a hotel or a sailing is worth
 * seeing here at all.
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
  const { weeks, byDay, inTrip } = useMemo(() => {
    const dated = trip.items.filter((i) => i.scheduledOn);
    const days = [
      trip.startDate,
      trip.endDate ?? trip.startDate,
      ...dated.map((i) => i.scheduledOn!),
      ...dated.map((i) => i.endsOn ?? i.scheduledOn!),
    ].sort();

    const first = days[0] ?? trip.startDate;
    const last = days[days.length - 1] ?? trip.startDate;

    const map = new Map<string, { item: TripItemWithStops; starts: boolean }[]>();
    for (const item of dated) {
      const from = parseDay(item.scheduledOn!);
      const to = parseDay(item.endsOn ?? item.scheduledOn!);
      const cursor = new Date(from);
      while (cursor <= to) {
        const key = isoDay(cursor);
        const list = map.get(key) ?? [];
        list.push({ item, starts: key === item.scheduledOn });
        map.set(key, list);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const tripEnd = trip.endDate ?? trip.startDate;
    return {
      weeks: buildWeeks(first, last),
      byDay: map,
      inTrip: (day: string) => day >= trip.startDate && day <= tripEnd,
    };
  }, [trip.items, trip.startDate, trip.endDate]);

  const today = isoDay(new Date());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          Calendar
          {viewer && (
            <Badge variant="outline" className="text-2xs font-normal">
              {viewer.isYou ? "your share" : `${viewer.name}'s share`}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {weeks.map((week, wi) => {
          // The month name goes on the week that first enters it, rather than
          // splitting the grid into a heading per month — a trip that runs
          // across the turn of a month is one continuous stretch of days.
          const opensMonth =
            wi === 0 || week.some((d) => d.endsWith("-01"));
          const label = week.find((d) => d.endsWith("-01")) ?? week[0];
          return (
            <section key={week[0]} className="space-y-1">
              {opensMonth && (
                <Text className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {format(parseDay(label), "MMMM yyyy")}
                </Text>
              )}
              {wi === 0 && (
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((d, i) => (
                    <Text
                      key={i}
                      className="text-center text-2xs text-muted-foreground"
                    >
                      {d}
                    </Text>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7 gap-1">
                {week.map((day) => {
                  const entries = byDay.get(day) ?? [];
                  const cost = entries
                    .filter((e) => e.starts && e.item.price !== null)
                    .reduce(
                      (acc, e) => {
                        const c = readerCost(e.item, partySize, viewer);
                        return { low: acc.low + c.low, high: acc.high + c.high };
                      },
                      { low: 0, high: 0 }
                    );
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex min-h-16 flex-col gap-0.5 rounded-md border p-1 sm:min-h-24",
                        inTrip(day) ? "bg-card" : "bg-muted/30 text-muted-foreground",
                        day === today && "ring-2 ring-primary/40"
                      )}
                    >
                      <Mono
                        className={cn(
                          "text-2xs tabular-nums",
                          inTrip(day) ? "font-medium" : "text-muted-foreground"
                        )}
                      >
                        {Number(day.slice(-2))}
                      </Mono>

                      {/* Phone: a dot per item, because a title in a 50px cell
                          is unreadable either way. Tablet up: the real thing. */}
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {entries.map((e, i) => (
                          <span
                            key={`${e.item.id}-${i}`}
                            className={cn(
                              "size-1.5 rounded-full",
                              categoryMeta(e.item.category).dot,
                              !e.starts && "opacity-40"
                            )}
                          />
                        ))}
                      </div>

                      <ul className="hidden min-w-0 flex-1 flex-col gap-0.5 sm:flex">
                        {entries.map((e, i) => (
                          <li
                            key={`${e.item.id}-${i}`}
                            className={cn(
                              "flex min-w-0 items-center gap-1",
                              // A day the item merely runs through, not one it
                              // begins on: same colour, less weight.
                              !e.starts && "opacity-60"
                            )}
                          >
                            <CategoryIcon
                              category={e.item.category}
                              className="size-4 rounded-sm [&_svg]:size-2.5"
                            />
                            {/* Named on the day it begins, a bare thread after
                                that. Repeating "Star of t…" for seven days
                                said nothing and crowded out the days that had
                                something new on them. */}
                            {e.starts && (
                              <Text className="truncate text-2xs">{e.item.title}</Text>
                            )}
                          </li>
                        ))}
                      </ul>

                      {cost.high > 0 && (
                        <Mono className="mt-auto hidden truncate text-2xs text-muted-foreground sm:block">
                          {moneyRange(cost.low, cost.high, trip.currency)}
                        </Mono>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
