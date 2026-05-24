import Image from "next/image";
import { format } from "date-fns";
import {
  Bed,
  CalendarDays,
  DollarSign,
  ExternalLink,
  ListChecks,
  MapPin,
  Plane,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Eyebrow, Mono } from "@/components/ui/typography";
import type { PublicTripView } from "@/types/travel";

import { formatTripMoney } from "./trip-detail";

const CATEGORY_META: Record<
  string,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  lodging: { label: "Lodging", Icon: Bed },
  transport: { label: "Transport", Icon: Plane },
  food: { label: "Food", Icon: Utensils },
  activity: { label: "Activity", Icon: Sparkles },
  shopping: { label: "Shopping", Icon: ShoppingBag },
  other: { label: "Other", Icon: Tag },
};

function parseTripDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: string, end: string | null): string {
  const s = parseTripDate(start);
  if (!end || start === end) return format(s, "EEE, MMM d, yyyy");
  const e = parseTripDate(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  if (sameYear) {
    return `${format(s, "EEE, MMM d")} – ${format(e, "EEE, MMM d, yyyy")}`;
  }
  return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
}

function tripDays(start: string, end: string | null): number {
  const s = parseTripDate(start);
  const e = end ? parseTripDate(end) : s;
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

const NO_DATE_KEY = "__no_date__";

export function PublicTripViewRenderer({ view }: { view: PublicTripView }) {
  const { trip, items, photos } = view;

  const totalEstimate = items.reduce((sum, it) => {
    if (!it.price) return sum;
    const n = parseFloat(it.price);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.scheduledOn ?? NO_DATE_KEY;
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }
  const groupKeys = [...groups.keys()].filter((k) => k !== NO_DATE_KEY).sort();
  if (groups.has(NO_DATE_KEY)) groupKeys.push(NO_DATE_KEY);

  return (
    <article className="space-y-8">
      <header className="overflow-hidden rounded-xl border">
        <div
          className="relative aspect-[21/9] w-full bg-muted"
          style={trip.coverPhotoUrl ? undefined : { backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl && (
            <Image
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {trip.destination && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {trip.destination}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={CalendarDays} label="Duration" value={`${tripDays(trip.startDate, trip.endDate)} days`} />
        <Stat icon={ListChecks} label="Items" value={String(items.length)} />
        <Stat icon={DollarSign} label="Est. total" value={formatTripMoney(totalEstimate, trip.currency)} />
      </div>

      {trip.description && (
        <Card>
          <CardContent className="p-5">
            <Eyebrow className="mb-2 block">About</Eyebrow>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
              {trip.description}
            </p>
          </CardContent>
        </Card>
      )}

      {photos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Trip photo"}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {groupKeys.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Itinerary</h2>
          <div className="space-y-6">
            {groupKeys.map((key) => {
              const groupItems = groups.get(key)!;
              const groupTotal = groupItems.reduce((sum, it) => {
                if (!it.price) return sum;
                const n = parseFloat(it.price);
                return Number.isFinite(n) ? sum + n : sum;
              }, 0);
              const label =
                key === NO_DATE_KEY ? "Unscheduled" : format(parseTripDate(key), "EEEE, MMM d");
              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-end justify-between border-b pb-1">
                      <h3 className="text-sm font-semibold tracking-tight">{label}</h3>
                      {groupTotal > 0 && (
                        <Mono className="text-xs text-muted-foreground">
                          {formatTripMoney(groupTotal, trip.currency)}
                        </Mono>
                      )}
                    </div>
                    <ul className="divide-y">
                      {groupItems.map((item) => {
                        const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other;
                        const Icon = meta.Icon;
                        return (
                          <li key={item.id} className="flex items-start gap-3 py-3">
                            <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                {item.price && (
                                  <Mono className="text-xs font-medium">
                                    {formatTripMoney(parseFloat(item.price), trip.currency)}
                                  </Mono>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{meta.label}</span>
                                {item.link && (
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" /> Open link
                                  </a>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground">{item.notes}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
