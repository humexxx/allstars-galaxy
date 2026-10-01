import Link from "next/link";
import { ArrowRight, CalendarDays, ListChecks, MapPin, Plane, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { formatDayRange } from "@/lib/utils/date";
import { getDashboardTravelSummary } from "@/lib/services/travel-service";
import { formatTripMoney } from "@/lib/travel/format";
import { daysBetween } from "@/lib/travel/calendar";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import type { DashboardTravelFeaturedTrip, DashboardTravelTripState } from "@/types/travel";

import { TripPhoto } from "./trip-photo";

const TRAVEL_PATH = "/portal/entertainment/travel-planner";
const NEW_TRAVEL_PATH = `${TRAVEL_PATH}/new`;

type DashboardTravelCardProps = {
  userId: string;
};

export async function DashboardTravelCard({ userId }: DashboardTravelCardProps) {
  const today = await getRequestTodayIso();
  const summary = await getDashboardTravelSummary(userId, today);

  if (!summary.featured) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Plane className="size-5" />
            Travel Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text variant="muted">
            Plan your next trip — dates, lodging, transport and a shareable link, all
            in one place.
          </Text>
          <Button asChild>
            <Link href={NEW_TRAVEL_PATH}>
              <Plus /> New trip
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
        <CardTitle as="h2" className="flex items-center gap-2">
          <Plane className="size-5" />
          Travel Planner
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={TRAVEL_PATH}>
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FeaturedTripCard trip={featured} today={today} />
      </CardContent>
    </Card>
  );
}

function FeaturedTripCard({
  trip,
  today,
}: {
  trip: DashboardTravelFeaturedTrip;
  today: string;
}) {
  return (
    <Link
      href={`${TRAVEL_PATH}/${trip.id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/40"
    >
      <div className="grid sm:grid-cols-[200px_1fr]">
        <div
          className="relative aspect-video sm:aspect-auto sm:h-full sm:min-h-35"
          // The trip colour under the photo too: it is what shows if the
          // cover link has died.
          style={{ backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl ? (
            <TripPhoto
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              sizes="(max-width: 640px) 100vw, 200px"
              fallback="none"
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
            <Eyebrow>{relativeLabel(trip, today)}</Eyebrow>
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
              <Mono>{formatDayRange(trip.startDate, trip.endDate)}</Mono>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="size-3.5" />
              <Mono>
                {trip.itemCount} {trip.itemCount === 1 ? "item" : "items"}
              </Mono>
            </span>
            {trip.totalEstimate > 0 && (
              <Mono className="font-medium text-foreground">
                {formatTripMoney(trip.totalEstimate, trip.currency)}
              </Mono>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * The Badge status variants rather than a colour chosen per card: happening
 * now is success, next is info, finished is a neutral outline.
 */
const STATE_BADGE: Record<
  DashboardTravelTripState,
  { label: string; variant: "success" | "info" | "outline" }
> = {
  in_progress: { label: "In progress", variant: "success" },
  upcoming: { label: "Upcoming", variant: "info" },
  past: { label: "Past", variant: "outline" },
};

function StateBadge({ state }: { state: DashboardTravelTripState }) {
  const { label, variant } = STATE_BADGE[state];
  return <Badge variant={variant}>{label}</Badge>;
}

/** "Ends in 3 days", "In 2 mo", "Yesterday" — counted on the reader's calendar. */
function relativeLabel(trip: DashboardTravelFeaturedTrip, today: string): string {
  if (trip.state === "in_progress") {
    const days = daysBetween(today, trip.endDate ?? trip.startDate);
    if (days === 0) return "Ends today";
    if (days === 1) return "Ends tomorrow";
    return `Ends in ${days} days`;
  }
  if (trip.state === "upcoming") {
    const days = daysBetween(today, trip.startDate);
    if (days === 0) return "Starts today";
    if (days === 1) return "Tomorrow";
    if (days <= 30) return `In ${days} days`;
    return `In ${Math.round(days / 30)} mo`;
  }
  const days = daysBetween(trip.endDate ?? trip.startDate, today);
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
