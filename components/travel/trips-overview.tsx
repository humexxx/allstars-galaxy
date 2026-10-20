"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Plane,
  Plus,
} from "lucide-react";

import { PageHeader } from "@/components/portal/page-header";
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
import {
  addMonths,
  daysBetween,
  laneCount,
  layOutTrips,
  monthWeeks,
  type PackedRun,
} from "@/lib/travel/calendar";
import { cn } from "@/lib/utils";
import { formatDay, formatDayRange, formatMonthLong } from "@/lib/utils/date";
import type { Trip } from "@/types/travel";

import { TripPhoto } from "./trip-photo";

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

/**
 * The pill on a trip's cover, on the reader's calendar.
 *
 * A trip under way says when it ends — it used to count from its START, so a
 * week in the cloud forest that began on Monday read "2 days ago" on
 * Wednesday, as if it were over. A past trip counts from its last day, in
 * months once it is a month gone, like the upcoming side does.
 */
export function relativeDays(trip: Pick<Trip, "startDate" | "endDate">, today: string): string {
  const lastDay = trip.endDate ?? trip.startDate;
  const untilStart = daysBetween(today, trip.startDate);
  if (untilStart > 0) {
    if (untilStart === 1) return "Tomorrow";
    if (untilStart <= 30) return `In ${untilStart} days`;
    return `In ${Math.round(untilStart / 30)} mo`;
  }
  const untilEnd = daysBetween(today, lastDay);
  if (untilEnd >= 0) {
    if (untilStart === 0) return "Starts today";
    if (untilEnd === 0) return "Ends today";
    if (untilEnd === 1) return "Ends tomorrow";
    return `Ends in ${untilEnd} days`;
  }
  const since = -untilEnd;
  if (since === 1) return "Yesterday";
  if (since <= 30) return `${since} days ago`;
  return `${Math.round(since / 30)} mo ago`;
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

const TITLE = "Travel Planner";

/**
 * The page's one "New trip": in the header beside the List / Calendar switch,
 * or in the empty state when there is nothing to switch between. The calendar
 * used to carry a second one under the month.
 */
function NewTripButton({ className }: { className?: string }) {
  return (
    <Button asChild className={className}>
      <Link href={NEW_TRIP_PATH}>
        <Plus />
        New trip
      </Link>
    </Button>
  );
}

/**
 * The whole trips page under the shell: its header, then the list or the
 * month. The switch sits in the header row, next to the title, rather than on
 * a row of its own above the content.
 */
export function TripsOverview({ trips, today }: TripsOverviewProps) {
  const { upcoming, past } = useMemo(() => partition(trips, today), [trips, today]);

  if (trips.length === 0) {
    return (
      <>
        <PageHeader title={TITLE} />
        <EmptyState
          variant="card"
          icon={Plane}
          title="No trips yet"
          description="Create your first trip to start planning destinations, dates and bookings."
          action={<NewTripButton />}
        />
      </>
    );
  }

  return (
    // `flex-1` down to the calendar, which fills what the shell leaves of the
    // window. The list just sits at the top of the same box.
    <Tabs defaultValue="list" className="flex flex-1 flex-col gap-6">
      <PageHeader
        title={TITLE}
        actions={
          <>
            {/* "List", not "Upcoming": the panel holds the past trips too, and
                a tab called Upcoming with a Past section inside it
                contradicted itself. Same words as the trip page's own List /
                Calendar switch. */}
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
            {/* Pushed to the far end on a phone, where the actions get a row
                of their own under the title. */}
            <NewTripButton className="ml-auto" />
          </>
        }
      />

      <TabsContent value="list" className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <Eyebrow asChild>
            <h2>Upcoming</h2>
          </Eyebrow>
          <TripGrid
            trips={upcoming}
            today={today}
            empty={{ title: "No upcoming trips", description: "Create one to start planning." }}
          />
        </section>
        {past.length > 0 && (
          <section className="flex flex-col gap-3">
            <Eyebrow asChild>
              <h2>Past</h2>
            </Eyebrow>
            <TripGrid trips={past} today={today} dimmed />
          </section>
        )}
      </TabsContent>

      <TabsContent value="calendar" className="flex flex-col">
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
    // `h-full` on both: the grid stretches the link to the row's height, and
    // a card that did not follow it left a short card hanging beside a tall
    // one whose title ran to two lines.
    <Link href={tripPath(trip.id)} className="group block h-full">
      <Card
        className={cn(
          "h-full overflow-hidden pt-0 transition-shadow hover:shadow-md hover:ring-foreground/15",
          dimmed && "opacity-70"
        )}
      >
        <div
          className="relative aspect-video w-full bg-muted"
          // The trip colour under the photo too: it is what shows if the
          // cover link has died.
          style={{ backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl ? (
            <TripPhoto
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              fallback="none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <ImageIcon className="size-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Dark and translucent rather than a Badge variant: it sits on a
              photograph, where any theme tint is unreadable. */}
          {/* /60, not /40: over a snowfield the lighter pill was white on
              light grey, about 2.8:1. */}
          <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {relativeDays(trip, today)}
          </div>
        </div>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            {/* Two lines: a trip name is long by nature, and one line cut
                "Islandia, Finlandia & Tomorrowland Winter" at the comma. */}
            <Heading level="h6" as="h3" className="line-clamp-2">
              {trip.title}
            </Heading>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          {trip.destination && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{trip.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
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
 * Where the first bar sits, clear of the day number, and how tall each lane
 * is. A week is tall enough for its deepest stack and never shorter than
 * MIN_WEEK; past that the month stretches to fill the window, so a short one
 * scrolls instead of squeezing six weeks into slivers.
 */
const LANE_TOP = 26;
const BAR_HEIGHT = 20;
const LANE_GAP = 2;
const MIN_WEEK = 64;

/**
 * Every trip on one month, each one a single bar from its first day to its
 * last — the length of the bar is the trip. A trip that wraps a week carries
 * on in the next row with square, borderless ends where it was cut, and trips
 * that share a day stack in lanes (`layOutTrips`).
 *
 * Days are YYYY-MM-DD strings throughout, compared as strings, so the memos
 * stay keyed on values that are equal from one render to the next.
 */
export function TripsCalendar({ trips, today }: { trips: Trip[]; today: string }) {
  const todayMonth = today.slice(0, 7);
  const [month, setMonth] = useState(todayMonth);
  /** The trip under the pointer, lit in every row it crosses. */
  const [lit, setLit] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const sorted = [...trips].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate)
    );
    // A trip that crosses three weeks is three bars and one link: the first
    // bar on screen is the one in the tab order and the accessibility tree.
    const seen = new Set<string>();
    return monthWeeks(month).map((week) => {
      const bars = layOutTrips(week, sorted).map((bar) => {
        const first = !seen.has(bar.value.id);
        seen.add(bar.value.id);
        return { ...bar, first };
      });
      return { week, bars, lanes: laneCount(bars) };
    });
  }, [trips, month]);

  return (
    // `min-h-min` on both clipped boxes: `overflow-hidden` drops a flex
    // item's automatic minimum to zero, so on a short window the month was
    // cut off at the bottom instead of the page scrolling to it.
    <Card size="sm" className="min-h-min flex-1">
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

      <CardContent className="flex flex-1 flex-col">
        <div className="flex min-h-min flex-1 flex-col gap-px overflow-hidden rounded-md border bg-border">
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="bg-muted/40 px-1 py-1.5 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {weeks.map(({ week, bars, lanes }) => (
            <div
              key={week[0]}
              data-slot="calendar-week"
              className="relative grid flex-1 grid-cols-7 gap-px"
              // A computed layout, not a spacing choice — see the constants.
              style={{
                minHeight: Math.max(MIN_WEEK, LANE_TOP + lanes * (BAR_HEIGHT + LANE_GAP) + 4),
              }}
            >
              {week.map((day) => (
                <DayCell key={day} day={day} month={month} today={today} />
              ))}

              {/* The bars ride over the days on a matching seven-column
                  track — same columns, same gap — which is the only way one
                  can cross a cell boundary and read as one thing. */}
              <div
                className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-x-px"
                style={{ top: LANE_TOP, rowGap: LANE_GAP }}
              >
                {bars.map((bar) => (
                  <TripBar
                    key={`${bar.value.id}-${bar.start}`}
                    trip={bar.value}
                    bar={bar}
                    lit={lit === bar.value.id}
                    onLight={setLit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DayCell({ day, month, today }: { day: string; month: string; today: string }) {
  const inMonth = day.slice(0, 7) === month;
  const isToday = day === today;
  return (
    <div
      aria-current={isToday ? "date" : undefined}
      className={cn(
        "group relative bg-card p-1",
        // The page's own ground, not a muted wash: in the dark theme
        // `bg-muted/20` came out LIGHTER than the card, so the days outside
        // the month were the ones that stood out.
        !inMonth && "bg-background text-muted-foreground"
      )}
    >
      {/* The whole day is the "plan a trip here" target. The bars sit above
          it and keep their own links. */}
      {inMonth && (
        <Link
          href={newTripWithDate(day)}
          aria-label={`New trip on ${formatDay(day)}`}
          className="absolute inset-0 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      )}
      <div className="pointer-events-none relative flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-2xs tabular-nums",
            isToday && "bg-primary font-semibold text-primary-foreground"
          )}
        >
          {Number(day.slice(-2))}
        </span>
        {inMonth && (
          <Plus
            aria-hidden
            className="hidden size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block"
          />
        )}
      </div>
    </div>
  );
}

function TripBar({
  trip,
  bar,
  lit,
  onLight,
}: {
  trip: Trip;
  bar: Omit<PackedRun<Trip>, "value"> & { first: boolean };
  lit: boolean;
  onLight: (id: string | null) => void;
}) {
  const range = formatDayRange(trip.startDate, trip.endDate);
  const light = () => onLight(trip.id);
  const dim = () => onLight(null);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={tripPath(trip.id)}
          data-slot="trip-bar"
          onMouseEnter={light}
          onMouseLeave={dim}
          onFocus={light}
          onBlur={dim}
          style={{
            gridColumn: `${bar.start + 1} / span ${bar.span}`,
            gridRow: bar.lane + 1,
            height: BAR_HEIGHT,
            // A wash of the trip's colour with a rim of it, and the label in
            // the text colour: white on the solid slot was 3.2:1 on orange
            // and 2.2:1 on yellow.
            backgroundColor: `color-mix(in oklch, ${trip.color} ${lit ? 40 : 22}%, var(--card))`,
            borderColor: `color-mix(in oklch, ${trip.color} 60%, transparent)`,
          }}
          className={cn(
            "pointer-events-auto flex min-w-0 items-center border px-1.5 text-2xs font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            // A rounded, inset end is where the trip begins or ends; a square
            // one running into the edge with no rim is where the week cut it.
            bar.opensRun ? "ml-1 rounded-l-sm" : "rounded-l-none border-l-0",
            bar.closesRun ? "mr-1 rounded-r-sm" : "rounded-r-none border-r-0"
          )}
          {...(bar.first
            ? { "aria-label": `${trip.title}, ${range}` }
            : { tabIndex: -1, "aria-hidden": true })}
        >
          <span className="truncate">{trip.title}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="block font-medium">{trip.title}</span>
        {trip.destination && <span className="block opacity-80">{trip.destination}</span>}
        <span className="block tabular-nums opacity-80">{range}</span>
      </TooltipContent>
    </Tooltip>
  );
}
