"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eyebrow, Heading, Mono } from "@/components/ui/typography";
import { addMonths, daysBetween, monthWeeks } from "@/lib/travel/calendar";
import { cn } from "@/lib/utils";
import { formatDayRange, formatMonthLong } from "@/lib/utils/date";
import type { Trip } from "@/types/travel";

type TripsOverviewProps = {
  trips: Trip[];
  /**
   * Today as YYYY-MM-DD, decided once by the server. Reading the clock here
   * rendered "Tomorrow" on the server and "In 2 days" in the browser either
   * side of midnight, and React threw the page's markup away over it.
   */
  today: string;
};

const NEW_TRIP_PATH = "/portal/entertainment/travel-planner/new";

function tripPath(id: string): string {
  return `/portal/entertainment/travel-planner/${id}`;
}

function newTripWithDate(isoDate: string): string {
  return `${NEW_TRIP_PATH}?startDate=${isoDate}`;
}

function relativeDays(start: string, today: string): string {
  const diff = daysBetween(today, start);
  if (diff === 0) return "Starts today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff <= 30) return `In ${diff} days`;
  if (diff > 30) return `In ${Math.round(diff / 30)} mo`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

function partition(trips: Trip[], today: string): { upcoming: Trip[]; past: Trip[] } {
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const t of trips) {
    const lastDay = t.endDate ?? t.startDate;
    if (lastDay >= today) upcoming.push(t);
    else past.push(t);
  }
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { upcoming, past };
}

export function TripsOverview({ trips, today }: TripsOverviewProps) {
  const { upcoming, past } = useMemo(() => partition(trips, today), [trips, today]);

  return (
    <Tabs defaultValue="upcoming" className="flex flex-col gap-6">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming" className="flex flex-col gap-6">
        {/* Keeps the outline in step (h1 page title, h2 section, h3 trip)
            without printing a heading the selected tab already shows. */}
        <h2 className="sr-only">Upcoming trips</h2>
        <TripGrid
          trips={upcoming}
          today={today}
          empty={{ title: "No upcoming trips", description: "Create one to start planning." }}
        />
        {past.length > 0 && (
          <section className="flex flex-col gap-3">
            <Eyebrow asChild>
              <h2>Past</h2>
            </Eyebrow>
            <TripGrid trips={past} today={today} dimmed />
          </section>
        )}
      </TabsContent>

      <TabsContent value="calendar">
        <TripsCalendar trips={trips} today={today} />
      </TabsContent>
    </Tabs>
  );
}

function TripGrid({
  trips,
  today,
  empty,
  dimmed = false,
}: {
  trips: Trip[];
  today: string;
  empty?: { title: string; description?: string };
  dimmed?: boolean;
}): React.ReactElement | null {
  if (trips.length === 0) {
    if (!empty) return null;
    return (
      <EmptyState icon={CalendarDays} title={empty.title} description={empty.description} />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} today={today} dimmed={dimmed} />
      ))}
    </div>
  );
}

function TripCard({
  trip,
  today,
  dimmed = false,
}: {
  trip: Trip;
  today: string;
  dimmed?: boolean;
}) {
  return (
    <Link href={tripPath(trip.id)} className="group block">
      <Card
        className={cn(
          "overflow-hidden pt-0 transition-shadow hover:shadow-md hover:ring-foreground/15",
          dimmed && "opacity-70"
        )}
      >
        <div
          className="relative aspect-video w-full bg-muted"
          style={trip.coverPhotoUrl ? undefined : { backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl ? (
            <Image
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              // See trip-detail.tsx — covers may be external URLs.
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <ImageIcon className="size-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Dark and translucent rather than a Badge variant: it sits on a
              photograph, where any theme tint is unreadable. */}
          <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {relativeDays(trip.startDate, today)}
          </div>
        </div>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <Heading level="h6" as="h3" className="line-clamp-1">
              {trip.title}
            </Heading>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          {trip.destination && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              <span className="line-clamp-1">{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <Mono>{formatDayRange(trip.startDate, trip.endDate)}</Mono>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------- Calendar ----------

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Every trip on one month. Days are YYYY-MM-DD strings throughout, compared as
 * strings — the same approach as the trip page's calendar, and it keeps the
 * memos keyed on values that are equal from one render to the next (the Date
 * objects this used to build were new every render, so nothing was memoised).
 */
function TripsCalendar({ trips, today }: { trips: Trip[]; today: string }) {
  const todayMonth = today.slice(0, 7);
  const [month, setMonth] = useState(todayMonth);

  const days = useMemo(() => monthWeeks(month).flat(), [month]);

  /** The trips on each visible day, earliest start first. */
  const tripsByDay = useMemo(() => {
    const first = days[0];
    const last = days[days.length - 1];
    const visible = trips
      .filter((t) => (t.endDate ?? t.startDate) >= first && t.startDate <= last)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const map = new Map<string, Trip[]>();
    for (const day of days) {
      const matches = visible.filter(
        (t) => t.startDate <= day && (t.endDate ?? t.startDate) >= day
      );
      if (matches.length) map.set(day, matches);
    }
    return map;
  }, [trips, days]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle as="h2">{formatMonthLong(`${month}-01`)}</CardTitle>
        <CardAction className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={month === todayMonth}
            onClick={() => setMonth(todayMonth)}
          >
            Today
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="bg-muted/40 px-2 py-1.5 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {days.map((day) => {
            const inMonth = day.slice(0, 7) === month;
            const isToday = day === today;
            const dayTrips = tripsByDay.get(day) ?? [];
            const primary = dayTrips[0];
            return (
              <div
                key={day}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "group relative min-h-22 bg-card p-1.5",
                  !inMonth && "bg-muted/20 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded-full text-2xs",
                      isToday && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {Number(day.slice(-2))}
                  </span>
                  {inMonth && (
                    <Link
                      href={primary ? tripPath(primary.id) : newTripWithDate(day)}
                      className="rounded p-0.5 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={primary ? `Open ${primary.title}` : `New trip on ${day}`}
                    >
                      <Plus className="size-3" />
                    </Link>
                  )}
                </div>

                <div className="mt-1 flex flex-col gap-0.5">
                  {dayTrips.slice(0, 3).map((trip) => {
                    // Label only on the first day of each trip; subsequent days
                    // get a thin marker bar so the cell stays uncluttered.
                    const isStart = trip.startDate === day;
                    const range = formatDayRange(trip.startDate, trip.endDate);
                    const bar = (
                      <Link
                        href={tripPath(trip.id)}
                        className="block truncate rounded px-1.5 py-0.5 text-2xs font-medium text-white shadow-sm"
                        style={{ backgroundColor: trip.color }}
                        // A continuation day repeats the start day's link, so
                        // it stays out of the tab order and out of the
                        // accessibility tree instead of reading as "·" once
                        // per day of the trip.
                        {...(isStart
                          ? { "aria-label": `${trip.title}, ${range}` }
                          : { tabIndex: -1, "aria-hidden": true })}
                      >
                        {isStart ? trip.title : "·"}
                      </Link>
                    );
                    return (
                      <Tooltip key={trip.id}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="block font-medium">{trip.title}</span>
                          <span className="block tabular-nums opacity-80">{range}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {dayTrips.length > 3 && (
                    <span className="block px-1.5 text-2xs text-muted-foreground">
                      +{dayTrips.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Click a day to plan a new trip · click a bar to open the trip</span>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href={NEW_TRIP_PATH}>
              <Plus /> New trip
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
