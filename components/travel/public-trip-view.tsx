import { CalendarDays, ClipboardList, ExternalLink, MapPin } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatShortDay } from "@/lib/utils/date";
import type { CalendarTrip, PublicTripView } from "@/types/travel";

import {
  dayGroupLabel,
  formatDateRange,
  formatTripMoney,
  moneyRange,
  runsUntil,
} from "@/lib/travel/format";
import { itemCost, unitSuffix } from "@/lib/travel/pricing";
// One category table, not a second copy that drifts: this page once labelled
// flights and cruises "Other" because they were missing from its own list.
import { CategoryIcon, categoryMeta } from "@/components/travel/category";
import { PublicTripViews } from "@/components/travel/public-trip-views";
import { ItemItinerary } from "@/components/travel/item-itinerary";
import { ActivityVideo } from "@/components/travel/activity-video";
import { TripPhoto } from "@/components/travel/trip-photo";

const NO_DATE_KEY = "__no_date__";

/**
 * The trip as its recipient sees it: the planner's own layout, with nothing
 * to press.
 *
 * It reads like the planner on purpose — same banner, same day groups, same
 * money in the same column — because the owner describes the link by what
 * they are looking at, and a recipient who sees something else has to be told
 * how to map one onto the other. What it does not have is a single control:
 * no add, no edit, no menu, no drag. A share link grants a view.
 */
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
  const scopedLines = scope ? new Map(scope.lines.map((l) => [l.itemId, l])) : null;
  const lineCost = (item: (typeof items)[number]) => {
    if (scopedLines) return scopedLines.get(item.id) ?? { low: 0, high: 0 };
    // Costed by the service, with the party it is for: re-costing here with
    // a party of one reported a train for four as one fare.
    return { low: item.cost.low, high: item.cost.high };
  };

  const estimate = scope
    ? { low: scope.owedLow, high: scope.owedHigh }
    : items.reduce(
        (acc, item) =>
          item.price === null
            ? acc
            : { low: acc.low + item.cost.low, high: acc.high + item.cost.high },
        { low: 0, high: 0 }
      );

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.scheduledOn ?? NO_DATE_KEY;
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }
  const groupKeys = [...groups.keys()].filter((k) => k !== NO_DATE_KEY).sort();
  if (groups.has(NO_DATE_KEY)) groupKeys.push(NO_DATE_KEY);

  // A range, like everything else that is still an estimate. Only what has
  // been paid is one figure — that money either moved or it did not.
  // Against the low estimate: it is the figure that can actually be settled,
  // and measuring against the high one leaves a fully-paid share reading as
  // short.
  const pct =
    scope && scope.owedLow > 0
      ? Math.min(100, (scope.paid / scope.owedLow) * 100)
      : 0;
  /**
   * What the calendar needs, and nothing more.
   *
   * Picked field by field rather than spread from the trip: this lands in the
   * RSC payload of a page anybody with the link can open, and a spread carried
   * the owner's auth id along with it. The member lists stay empty for the
   * same reason the service strips them — the scope's own per-item figures
   * arrive as the viewer instead.
   */
  const calendarTrip: CalendarTrip = {
    id: trip.id,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    members: [],
    items: items.map((item) => ({ ...item, payerIds: [], attendeeIds: [] })),
  };

  /** The bars' prices on a whole-trip link, from the same figures as the list. */
  const calendarCosts = scope
    ? undefined
    : new Map(items.map((item) => [item.id, { low: item.cost.low, high: item.cost.high }]));

  const publicViewer = scope
    ? {
        // The service has already narrowed `items` to this traveller's, and
        // the trip's member ids stay on the server.
        memberId: null,
        name: scope.memberName,
        isYou: false,
        lines: new Map(scope.lines.map((l) => [l.itemId, { low: l.low, high: l.high }])),
      }
    : null;

  const left = scope
    ? {
        low: Math.max(0, scope.owedLow - scope.paid),
        high: Math.max(0, scope.owedHigh - scope.paid),
      }
    : { low: 0, high: 0 };

  // Full bleed on a phone, like the planner's — the page gutters were cropping
  // the cover for no gain. The negative margin lives on the wrapper in
  // `PublicTripViews`, which is also the view switcher's positioning context.
  const banner = (
      <header className="overflow-hidden border-y sm:rounded-xl sm:border">
        <div
          // Same floor as the planner's banner: at 21/9 a 390px phone leaves
          // 167px and the pill lands on top of the title.
          className="relative flex min-h-72 w-full flex-col bg-muted sm:aspect-21/9 sm:min-h-auto"
          // The trip colour under the photo too: it is what shows if the
          // cover link has died.
          style={{ backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl && (
            <TripPhoto
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              fallback="none"
            />
          )}
          {/* Deeper through the middle than it was (/20): a long name runs
              two or three lines up into the photo, and over a snowfield its
              top line was white on pale grey. The controls up top carry
              their own solid surfaces, so the top can stay clear. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          {/* In flow, not `absolute inset-0`: pinned over a box of fixed
              height, a long name ("Islandia, Finlandia & Tomorrowland
              Winter: the long way round") pushed the dates out of the bottom
              of the banner on a phone, and the 21/9 box clipped it at
              tablet width. The ratio and the floor are minimums now — the
              banner grows when its words need it. */}
          <div className="relative flex flex-1 flex-col justify-between gap-4 p-4 text-white sm:p-6">
            <div className="flex items-start justify-between gap-2">
              {showPrices ? (
                // Solid, not translucent: the photograph underneath is unknown
                // and a light-wash cover leaves white text on white.
                <div className="flex min-w-56 flex-col justify-center rounded-xl bg-black/70 px-3 py-2 ring-1 ring-white/15 backdrop-blur-sm">
                  <Mono className="truncate text-lg font-semibold leading-tight tabular-nums text-white">
                    {moneyRange(estimate.low, estimate.high, trip.currency)}
                  </Mono>
                  <Text className="truncate text-2xs leading-tight text-white/70">
                    {scope ? `${scope.memberName} pays` : "trip total"}
                  </Text>
                </div>
              ) : (
                <span />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Heading level="hero" className="text-white text-shadow-sm">
                {trip.title}
              </Heading>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                {trip.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" /> {trip.destination}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" />
                  <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>
  );

  const list = (
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                Itinerary
                {items.length > 0 && (
                  <Badge variant="secondary" className="text-2xs font-normal">
                    {items.length}
                  </Badge>
                )}
                {scope && showPrices && (
                  <Badge variant="outline" className="text-2xs font-normal">
                    {scope.memberName}&apos;s share
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {groupKeys.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing planned yet"
                  description="Items appear here as the trip takes shape."
                />
              )}

              {groupKeys.map((key) => {
                const groupItems = groups.get(key)!;
                const total = groupItems.reduce(
                  (acc, it) => {
                    if (!it.price) return acc;
                    const c = lineCost(it);
                    return { low: acc.low + c.low, high: acc.high + c.high };
                  },
                  { low: 0, high: 0 }
                );
                const label =
                  key === NO_DATE_KEY
                    ? "Unscheduled"
                    : dayGroupLabel(key, runsUntil(groupItems));
                return (
                  <section key={key} className="flex flex-col gap-2">
                    <div className="flex items-end justify-between gap-2 border-b pb-1">
                      <Heading level="h6" as="h3">
                        {label}
                      </Heading>
                      {showPrices && total.high > 0 && (
                        <Mono className="shrink-0 text-xs text-muted-foreground">
                          {moneyRange(total.low, total.high, trip.currency)}
                        </Mono>
                      )}
                    </div>
                    <ul className="-mx-2 divide-y">
                      {groupItems.map((item) => {
                        const meta = categoryMeta(item.category);
                        const cost = lineCost(item);
                        return (
                          <li key={item.id} className="flex items-start gap-3 px-2 py-3">
                            <CategoryIcon category={item.category} />
                            {/* The planner's row, minus the button: the price
                                spans the title and its category line so a
                                two-line figure never pushes the category away,
                                and the title wraps rather than truncating. */}
                            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
                              <Text weight="medium" className="col-span-2 row-start-1 line-clamp-2 break-words sm:col-span-1">
                                {item.title}
                              </Text>
                              {showPrices && item.price && (
                                <span className="col-start-2 row-start-2 text-right sm:row-span-2 sm:row-start-1">
                                  <Mono className="block whitespace-nowrap text-xs font-medium">
                                    {moneyRange(cost.low, cost.high, trip.currency)}
                                  </Mono>
                                  {scope ? (
                                    // A share leads, and the booking price
                                    // stays in view under it — as on the
                                    // planner with a traveller selected.
                                    <Mono className="block whitespace-nowrap text-2xs text-muted-foreground">
                                      of {moneyRange(item.cost.low, item.cost.high, trip.currency)}
                                    </Mono>
                                  ) : (
                                    <UnitArithmetic item={item} currency={trip.currency} />
                                  )}
                                </span>
                              )}
                              <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{meta.label}</span>
                                {(item.fromCode || item.toCode) && (
                                  <Mono className="text-2xs font-medium">
                                    {item.fromCode ?? "?"}
                                    <span
                                      className="mx-1"
                                      role="img"
                                      aria-label={item.roundTrip ? "round trip to" : "to"}
                                    >
                                      {item.roundTrip ? "⇄" : "→"}
                                    </span>
                                    {item.toCode ?? "?"}
                                  </Mono>
                                )}
                                {item.endsOn &&
                                  item.scheduledOn &&
                                  item.endsOn !== item.scheduledOn && (
                                    <span>
                                      {item.roundTrip ? "back " : "through "}
                                      {formatShortDay(item.endsOn)}
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
                              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 empty:hidden">
                              {showPrices && item.notes && (
                                <Text variant="small">{item.notes}</Text>
                              )}
                              {item.stops.length > 0 && (
                                <ItemItinerary stops={item.stops} />
                              )}
                              {item.photos.length > 0 && (
                                <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 pt-1">
                                  {item.photos.map((photo, i) => (
                                    <div
                                      key={photo.id}
                                      className="relative aspect-square w-20 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
                                    >
                                      <TripPhoto
                                        src={photo.url}
                                        alt={photo.caption ?? `${item.title} photo ${i + 1}`}
                                        sizes="80px"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* The same embed the planner shows. It routes
                                  YouTube through youtube-nocookie, which is
                                  the whole reason that choice exists: a
                                  visitor holding a share token has agreed to
                                  nothing. */}
                              {item.videoUrl && (
                                <div className="pt-2">
                                  <ActivityVideo
                                    url={item.videoUrl}
                                    title={item.title}
                                  />
                                </div>
                              )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </CardContent>
          </Card>
  );

  const aside = (
        <>
          {showPrices && scope && (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Your share</CardTitle>
              </CardHeader>
              {/* The same shape the planner's Payments card uses: the figure
                  paid, what it is against, and a bar — a number on its own
                  does not say whether it is nearly there or barely started. */}
              <CardContent className="flex flex-col gap-1.5">
                {/* Wraps: in the narrow aside at 1024px the "of $8,747 ~ $9,977"
                    beside the paid figure ran off the card's edge and was cut. */}
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatTripMoney(scope.paid, trip.currency)}
                  </Mono>
                  <Mono className="shrink-0 text-xs text-muted-foreground">
                    of {moneyRange(scope.owedLow, scope.owedHigh, trip.currency)}
                  </Mono>
                </div>
                <Progress value={pct} aria-label="Paid so far" />
                <Text className="text-pretty text-2xs text-muted-foreground">
                  {left.low > 0 ? (
                    <>
                      {formatTripMoney(left.low, trip.currency)} still to go
                      {left.high > left.low && (
                        <> — up to {formatTripMoney(left.high, trip.currency)} if every
                          estimate lands high</>
                      )}
                    </>
                  ) : (
                    "Covered against the low estimate."
                  )}
                </Text>
              </CardContent>
            </Card>
          )}

          {photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                {/* One scrolling row, like the planner's: a grid grew a line
                    for every three photos and pushed the page down. */}
                <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                  {photos.map((photo, i) => (
                    <div
                      key={photo.id}
                      className={cn(
                        "relative aspect-square w-28 shrink-0 snap-start",
                        "overflow-hidden rounded-md border bg-muted"
                      )}
                    >
                      <TripPhoto
                        src={photo.url}
                        alt={photo.caption ?? `${trip.title} photo ${i + 1}`}
                        sizes="112px"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
    </>
  );

  return (
    <PublicTripViews
      banner={banner}
      list={list}
      aside={aside}
      trip={calendarTrip}
      viewer={publicViewer}
      costs={calendarCosts}
      showPrices={showPrices}
    />
  );
}

/**
 * "$180 / night × 5" under a figure that is five nights of it.
 *
 * The page used to print the bare unit — "$900" over "/ night" — which reads
 * as a $900 nightly rate. The planner shows its working; so does this.
 */
function UnitArithmetic({
  item,
  currency,
}: {
  item: PublicTripView["items"][number];
  currency: string;
}) {
  if (item.priceUnit === "total") return null;
  // Unit prices do not depend on the party; only `times` does, and that came
  // from the server.
  const unit = itemCost(item, 1);
  const unitLabel =
    unit.unitHigh !== null && unit.unitHigh > (unit.unitLow ?? 0)
      ? `${formatTripMoney(unit.unitLow ?? 0, currency)}~${formatTripMoney(unit.unitHigh, currency)}`
      : formatTripMoney(unit.unitLow ?? 0, currency);
  return (
    <Mono className="block whitespace-nowrap text-2xs text-muted-foreground">
      {item.cost.times > 1
        ? `${unitLabel} ${unitSuffix(item.priceUnit)} × ${item.cost.times}`
        : unitSuffix(item.priceUnit)}
    </Mono>
  );
}
