"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/travel";

type TripsOverviewProps = {
  trips: Trip[];
};

const NEW_TRIP_PATH = "/portal/entertainment/travel-planner/new";

function tripPath(id: string): string {
  return `/portal/entertainment/travel-planner/${id}`;
}

function newTripWithDate(isoDate: string): string {
  return `${NEW_TRIP_PATH}?startDate=${isoDate}`;
}

function parseTripDate(value: string): Date {
  // Trip dates come from Postgres `date` columns → string "YYYY-MM-DD". Build
  // a local Date so we don't shift the day by the user's timezone offset.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string, end: string | null): string {
  const s = parseTripDate(start);
  if (!end) return format(s, "MMM d, yyyy");
  const e = parseTripDate(end);
  if (start === end) return format(s, "MMM d, yyyy");
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`;
  }
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

function relativeDays(start: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = parseTripDate(start);
  const diff = Math.round((s.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Starts today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 30) return `In ${diff} days`;
  if (diff > 30) return `In ${Math.round(diff / 30)} mo`;
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return "";
}

function partition(trips: Trip[]): { upcoming: Trip[]; past: Trip[] } {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const t of trips) {
    const lastDay = t.endDate ?? t.startDate;
    if (lastDay >= todayStr) upcoming.push(t);
    else past.push(t);
  }
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { upcoming, past };
}

export function TripsOverview({ trips }: TripsOverviewProps) {
  const { upcoming, past } = useMemo(() => partition(trips), [trips]);

  return (
    <Tabs defaultValue="upcoming" className="space-y-6">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="space-y-8">
        <TripGrid trips={upcoming} empty="No upcoming trips. Create one to start planning." />
        {past.length > 0 && (
          <section className="space-y-3">
            <Eyebrow>Past</Eyebrow>
            <TripGrid trips={past} dimmed />
          </section>
        )}
      </TabsContent>

      <TabsContent value="calendar">
        <TripCalendar trips={trips} />
      </TabsContent>
    </Tabs>
  );
}

function TripGrid({
  trips,
  empty,
  dimmed = false,
}: {
  trips: Trip[];
  empty?: string;
  dimmed?: boolean;
}) {
  if (trips.length === 0) {
    if (!empty) return null;
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <Text variant="muted">{empty}</Text>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} dimmed={dimmed} />
      ))}
    </div>
  );
}

function TripCard({ trip, dimmed = false }: { trip: Trip; dimmed?: boolean }) {
  return (
    <Link href={tripPath(trip.id)} className="group block">
      <Card
        className={cn(
          "overflow-hidden pt-0 transition-shadow hover:shadow-md",
          dimmed && "opacity-70"
        )}
      >
        <div
          className="relative aspect-[16/9] w-full bg-muted"
          style={
            trip.coverPhotoUrl
              ? {
                  backgroundImage: `url(${trip.coverPhotoUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { backgroundColor: trip.color }
          }
        >
          {!trip.coverPhotoUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {relativeDays(trip.startDate)}
          </div>
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-base font-semibold tracking-tight">
              {trip.title}
            </h3>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          {trip.destination && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <Mono className="text-xs">{formatDateRange(trip.startDate, trip.endDate)}</Mono>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------- Calendar ----------

type CalendarBar = {
  trip: Trip;
  start: Date;
  end: Date;
  // Sub-row inside the day cell. We lay overlapping trips on different rows so
  // the bars don't paint over each other.
  row: number;
};

function TripCalendar({ trips }: { trips: Trip[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  // Layout: assign each trip to a row index by scanning the month. Earliest
  // start wins the lower row; subsequent overlapping trips bump up a row.
  const bars: CalendarBar[] = useMemo(() => {
    const visibleTrips = trips.filter((t) => {
      const start = parseTripDate(t.startDate);
      const end = t.endDate ? parseTripDate(t.endDate) : start;
      return end >= gridStart && start <= gridEnd;
    });
    visibleTrips.sort((a, b) => a.startDate.localeCompare(b.startDate));

    const rowEnds: Date[] = []; // end date currently occupying each row
    const out: CalendarBar[] = [];
    for (const trip of visibleTrips) {
      const start = parseTripDate(trip.startDate);
      const end = trip.endDate ? parseTripDate(trip.endDate) : start;
      let row = 0;
      while (row < rowEnds.length && rowEnds[row] >= start) row++;
      rowEnds[row] = end;
      out.push({ trip, start, end, row });
    }
    return out;
  }, [trips, gridStart, gridEnd]);

  const barsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarBar[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const today = parseTripDate(key);
      const matches = bars.filter((b) => b.start <= today && b.end >= today);
      if (matches.length) map.set(key, matches);
    }
    return map;
  }, [bars, days]);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight">
            {format(cursor, "MMMM yyyy")}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="bg-muted/40 px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, cursor);
            const dayBars = barsByDayKey.get(key) ?? [];
            const primary = dayBars[0]?.trip;
            return (
              <div
                key={key}
                className={cn(
                  "relative min-h-[88px] bg-background p-1.5",
                  !inMonth && "bg-muted/20 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      isToday(day) && "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {inMonth && (
                    <Link
                      href={primary ? tripPath(primary.id) : newTripWithDate(key)}
                      className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      aria-label={primary ? `Open ${primary.title}` : `New trip on ${key}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {dayBars.slice(0, 3).map(({ trip }) => {
                    const isStart = format(trip.startDate ? parseTripDate(trip.startDate) : day, "yyyy-MM-dd") === key;
                    return (
                      <Link
                        key={trip.id}
                        href={tripPath(trip.id)}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm",
                        )}
                        style={{ backgroundColor: trip.color }}
                        title={`${trip.title} · ${formatDateRange(trip.startDate, trip.endDate)}`}
                      >
                        {isStart ? trip.title : "·"}
                      </Link>
                    );
                  })}
                  {dayBars.length > 3 && (
                    <span className="block px-1.5 text-[10px] text-muted-foreground">
                      +{dayBars.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Click a day to plan a new trip · click a bar to open the trip</span>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={NEW_TRIP_PATH}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New trip
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

