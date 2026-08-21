import Image from "next/image";
import { format } from "date-fns";
import {
  Anchor,
  Bed,
  Bus,
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
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import type { PublicTripView } from "@/types/travel";

import {
  formatDateRange,
  formatTripMoney,
  parseTripDate,
  tripDurationLabel,
} from "@/lib/travel/format";
import { itemCost, tripCost } from "@/lib/travel/pricing";
import { moneyRange } from "@/components/travel/traveller-bar";

const CATEGORY_META: Record<
  string,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  lodging: { label: "Lodging", Icon: Bed },
  // Flights and cruises used to fall through to "Other", so the public page
  // labelled the two biggest lines of a trip as nothing in particular.
  flight: { label: "Flight", Icon: Plane },
  cruise: { label: "Cruise", Icon: Anchor },
  transport: { label: "Transport", Icon: Bus },
  food: { label: "Food", Icon: Utensils },
  activity: { label: "Activity", Icon: Sparkles },
  shopping: { label: "Shopping", Icon: ShoppingBag },
  other: { label: "Other", Icon: Tag },
};

const NO_DATE_KEY = "__no_date__";

export function PublicTripViewRenderer({ view }: { view: PublicTripView }) {
  const { trip, items, photos, share, scope } = view;

  /**
   * Whether this link may show money at all.
   *
   * The column has always existed and defaulted to false; the renderer simply
   * never read it, so every "share my trip" link published the costs anyway.
   */
  const showPrices = share.showPrices;

  /** What each item costs whoever holds this link. */
  const scopedLines = scope
    ? new Map(scope.lines.map((l) => [l.itemId, l]))
    : null;
  const lineCost = (item: (typeof items)[number]) => {
    if (scopedLines) return scopedLines.get(item.id) ?? { low: 0, high: 0 };
    // Units applied, so a nightly rate is not reported as one night and a
    // per-person fare not as one traveller.
    const c = itemCost(item, 1);
    return { low: c.low, high: c.high };
  };

  const estimate = scope
    ? { low: scope.owedLow, high: scope.owedHigh }
    : (() => {
        const t = tripCost(items, 1);
        return { low: t.low, high: t.high };
      })();

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
              // See trip-detail.tsx — covers may be external URLs.
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
            <Heading level="h1" className="text-white">{trip.title}</Heading>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {trip.destination && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {trip.destination}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={CalendarDays}
          label="Duration"
          value={tripDurationLabel(trip.startDate, trip.endDate)}
        />
        <Stat icon={ListChecks} label="Items" value={String(items.length)} />
        {showPrices && (
          <Stat
            icon={DollarSign}
            label={scope ? `${scope.memberName.split(" ")[0]}'s share` : "Est. total"}
            value={moneyRange(estimate.low, estimate.high, trip.currency)}
          />
        )}
      </div>

      {showPrices && scope && (
        <Card>
          <CardContent className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-6">
            <div>
              <Eyebrow className="mb-1 block">Paid so far</Eyebrow>
              <Mono className="text-2xl font-semibold tabular-nums">
                {formatTripMoney(scope.paid, trip.currency)}
              </Mono>
            </div>
            <div className="text-right">
              <Eyebrow className="mb-1 block">Still to go</Eyebrow>
              <Mono className="text-2xl font-semibold tabular-nums">
                {formatTripMoney(Math.max(0, scope.owedLow - scope.paid), trip.currency)}
              </Mono>
            </div>
          </CardContent>
        </Card>
      )}

      {trip.description && (
        <Card>
          <CardContent className="p-6">
            <Eyebrow className="mb-2 block">About</Eyebrow>
            <Text className="whitespace-pre-wrap text-foreground/90">
              {trip.description}
            </Text>
          </CardContent>
        </Card>
      )}

      {photos.length > 0 && (
        <section className="space-y-3">
          <Heading level="h4" as="h2">Photos</Heading>
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
                  // Gallery photos may be `source: "url"` (external) — same
                  // rationale as trip covers.
                  unoptimized
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {groupKeys.length > 0 && (
        <section className="space-y-4">
          <Heading level="h4" as="h2">Itinerary</Heading>
          <div className="space-y-6">
            {groupKeys.map((key) => {
              const groupItems = groups.get(key)!;
              const groupTotal = groupItems.reduce(
                (acc, it) => {
                  if (!it.price) return acc;
                  const c = lineCost(it);
                  return { low: acc.low + c.low, high: acc.high + c.high };
                },
                { low: 0, high: 0 }
              );
              const label =
                key === NO_DATE_KEY ? "Unscheduled" : format(parseTripDate(key), "EEEE, MMM d");
              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-end justify-between border-b pb-1">
                      <Heading level="h6" as="h3">{label}</Heading>
                      {showPrices && groupTotal.high > 0 && (
                        <Mono className="text-xs text-muted-foreground">
                          {moneyRange(groupTotal.low, groupTotal.high, trip.currency)}
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
                              <Icon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <Text weight="medium" className="truncate">{item.title}</Text>
                                {showPrices && item.price && (
                                  <Mono className="shrink-0 whitespace-nowrap text-xs font-medium">
                                    {moneyRange(
                                      lineCost(item).low,
                                      lineCost(item).high,
                                      trip.currency
                                    )}
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
                                    <ExternalLink className="size-3" /> Open link
                                  </a>
                                )}
                              </div>
                              {item.notes && (
                                <Text variant="small">{item.notes}</Text>
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
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <Text variant="small" className="uppercase tracking-wider">{label}</Text>
          <Text weight="semibold" className="truncate tabular-nums">{value}</Text>
        </div>
      </CardContent>
    </Card>
  );
}
