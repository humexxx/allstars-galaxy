import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, ListChecks, MapPin, Plane, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { getDashboardTravelSummary } from "@/lib/services/travel-service";
import type { DashboardTravelFeaturedTrip, DashboardTravelTripState } from "@/types/travel";

const TRAVEL_PATH = "/portal/entertainment/travel-planner";
const NEW_TRAVEL_PATH = `${TRAVEL_PATH}/new`;

type DashboardTravelCardProps = {
  userId: string;
};

export async function DashboardTravelCard({ userId }: DashboardTravelCardProps) {
  const summary = await getDashboardTravelSummary(userId);

  if (!summary.featured) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Heading level="h5" as="h2" className="flex items-center gap-2">
            <Plane className="size-5" />
            Travel Planner
          </Heading>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text variant="muted" className="text-sm">
            Plan your next trip — dates, lodging, transport and a shareable link, all
            in one place.
          </Text>
          <Button asChild>
            <Link href={NEW_TRAVEL_PATH}>
              <Plus className="mr-1 size-4" /> New trip
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { featured, totalTrips, upcomingCount, inProgressCount } = summary;
  const subtitle = buildSubtitle({ totalTrips, upcomingCount, inProgressCount });

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h5" as="h2" className="flex items-center gap-2">
              <Plane className="size-5" />
              Travel Planner
            </Heading>
            <Text variant="muted" className="mt-1 text-sm">
              {subtitle}
            </Text>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={TRAVEL_PATH}>
              Open <ArrowRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <FeaturedTripCard trip={featured} />
      </CardContent>
    </Card>
  );
}

function FeaturedTripCard({ trip }: { trip: DashboardTravelFeaturedTrip }) {
  return (
    <Link
      href={`${TRAVEL_PATH}/${trip.id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <div className="grid sm:grid-cols-[200px_1fr]">
        <div
          className="relative aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[140px]"
          style={trip.coverPhotoUrl ? undefined : { backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl ? (
            <Image
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              fill
              sizes="(max-width: 640px) 100vw, 200px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <Plane className="size-10" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge state={trip.state} />
            <Eyebrow>{relativeLabel(trip)}</Eyebrow>
          </div>
          <div className="flex items-start justify-between gap-2">
            <Heading level="h6" as="h3" className="line-clamp-1">
              {trip.title}
            </Heading>
            <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {trip.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {trip.destination}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              <Mono className="text-xs">{formatDateRange(trip.startDate, trip.endDate)}</Mono>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="size-3.5" />
              <Mono className="text-xs">
                {trip.itemCount} {trip.itemCount === 1 ? "item" : "items"}
              </Mono>
            </span>
            {trip.totalEstimate > 0 && (
              <Mono className="text-xs font-medium text-foreground">
                {formatMoney(trip.totalEstimate, trip.currency)}
              </Mono>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Three hand-rolled pills became three Badge variants.
 *
 * They were raw emerald and sky, which is a colour asserting a meaning the
 * theme has no say in — a state indicator has to move with the palette, and
 * these carried their own `dark:` overrides to prove it. The variants say the
 * same thing in the theme's own terms: the trip you are on now is the one
 * worth pointing at, the next one is secondary, a finished one is an outline.
 */
const STATE_BADGE: Record<
  DashboardTravelTripState,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  in_progress: { label: "In progress", variant: "default" },
  upcoming: { label: "Upcoming", variant: "secondary" },
  past: { label: "Past", variant: "outline" },
};

function StateBadge({ state }: { state: DashboardTravelTripState }) {
  const { label, variant } = STATE_BADGE[state];
  return (
    <Badge variant={variant} className="text-2xs font-medium">
      {label}
    </Badge>
  );
}

function parseTripDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const s = parseTripDate(start);
  if (!end || start === end) return fmt(s);
  const e = parseTripDate(end);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${fmt(e)}`;
  }
  return `${fmt(s)} – ${fmt(e)}`;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function relativeLabel(trip: DashboardTravelFeaturedTrip): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (trip.state === "in_progress") {
    const endStr = trip.endDate ?? trip.startDate;
    const end = parseTripDate(endStr);
    const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);
    if (days === 0) return "Ends today";
    if (days === 1) return "Ends tomorrow";
    return `Ends in ${days} days`;
  }
  if (trip.state === "upcoming") {
    const start = parseTripDate(trip.startDate);
    const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
    if (days === 0) return "Starts today";
    if (days === 1) return "Tomorrow";
    if (days <= 30) return `In ${days} days`;
    return `In ${Math.round(days / 30)} mo`;
  }
  const end = parseTripDate(trip.endDate ?? trip.startDate);
  const days = Math.round((today.getTime() - end.getTime()) / 86_400_000);
  if (days === 1) return "Yesterday";
  if (days <= 30) return `${days} days ago`;
  return `${Math.round(days / 30)} mo ago`;
}

function buildSubtitle({
  totalTrips,
  upcomingCount,
  inProgressCount,
}: {
  totalTrips: number;
  upcomingCount: number;
  inProgressCount: number;
}): string {
  const parts: string[] = [`${totalTrips} ${totalTrips === 1 ? "trip" : "trips"}`];
  if (inProgressCount > 0) {
    parts.push(`${inProgressCount} in progress`);
  }
  if (upcomingCount > 0) {
    parts.push(`${upcomingCount} upcoming`);
  }
  return parts.join(" · ");
}
