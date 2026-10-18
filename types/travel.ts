import { tripItemCategoryEnum, tripPriceUnitEnum } from "@/db/schema";
import type {
  trips,
  tripContributions,
  tripItems,
  tripPhotos,
  tripShares,
} from "@/db/schema";

export type Trip = typeof trips.$inferSelect;
export type TripItem = typeof tripItems.$inferSelect;
export type TripPhoto = typeof tripPhotos.$inferSelect;
export type TripShare = typeof tripShares.$inferSelect;
export type TripContribution = typeof tripContributions.$inferSelect;

/** Derived from the `trip_item_category` enum so a new category cannot be
 *  half-added — the union used to be spelled out by hand right beside it. */
export type TripItemCategory = (typeof tripItemCategoryEnum.enumValues)[number];

export type TripPriceUnit = (typeof tripPriceUnitEnum.enumValues)[number];

/** A stop on a multi-day activity — one port of a cruise's itinerary. */
export type TripItemStop = {
  id: string;
  itemId: string;
  dayNumber: number;
  stopOn: string | null;
  place: string;
  note: string | null;
};

export type TripItemWithStops = TripItem & {
  stops: TripItemStop[];
  /**
   * Members covering this item. Empty means "however the trip splits".
   *
   * The table has existed since the schema did and nothing ever read it, so
   * every item was divided among everybody — which is wrong the moment two
   * people share a festival ticket the other two are not going to.
   */
  payerIds: string[];
  /**
   * Members this item is FOR. Empty means everybody on the trip.
   *
   * Separate from `payerIds` because the two answer different questions: all
   * four travellers go to the festival and two of them cover the package, and
   * a flight from one city is one traveller's whether or not somebody else
   * paid for it. Filtering read `payerIds` for a while and got both cases
   * wrong.
   */
  attendeeIds: string[];
  /** Photos attached to this item rather than to the trip's gallery. */
  photos: TripPhoto[];
};

export type TripMemberView = {
  id: string;
  name: string;
  email: string | null;
  /** Null means "an equal cut of what the fixed shares leave over". */
  sharePercent: number | null;
};

export type TripWithRelations = Trip & {
  members: TripMemberView[];
  items: TripItemWithStops[];
  photos: TripPhoto[];
  shares: TripShare[];
  contributions: TripContribution[];
};

/**
 * What the planner's month calendar reads: its whole trip, because a bar
 * there opens the item's editor. A share link draws from
 * `SharedCalendarTrip` instead.
 */
export type CalendarTrip = Pick<
  TripWithRelations,
  "id" | "startDate" | "endDate" | "currency" | "items" | "members"
>;

// Aggregated view returned by the public share lookup. Carries only what the
// public renderer needs — never expose the full share token list of a trip,
// just the share that was actually used.
/**
 * What a link scoped to one traveller shows: their money, and nobody else's.
 *
 * The split is worked out on the server so the browser never receives the
 * other travellers' names, percentages or balances — scoping a link would be
 * pointless if the data it hides still arrived in the payload. What each item
 * costs this traveller rides on the item, as `PublicTripItem.cost`.
 */
export type PublicTripScope = {
  memberName: string;
  owedLow: number;
  owedHigh: number;
  /** What they have handed over so far. */
  paid: number;
};

/**
 * An item as a public link may see it: what the page draws, and nothing else.
 *
 * Built field by field in the service, never spread from the row. The member
 * lists are raw `trip_members` UUIDs, and the raw prices say more than either
 * kind of link may: one without prices shows no money at all, and one made
 * for a single traveller shows what that traveller owes — never what the item
 * costs, which is everybody else's share as well.
 */
export type PublicTripItem = Pick<
  TripItemWithStops,
  | "id"
  | "title"
  | "category"
  | "link"
  | "videoUrl"
  | "fromCode"
  | "toCode"
  | "roundTrip"
  | "scheduledOn"
  | "endsOn"
  | "stops"
  | "photos"
> & {
  /**
   * What the item costs whoever holds the link: the item itself, or the
   * scoped traveller's share of it. Null when the link hides money or nobody
   * has priced the item.
   */
  cost: { low: number; high: number } | null;
  /** Beside a whole-trip figure only, where "/ night" explains it. */
  priceUnit: TripPriceUnit | null;
  /** Hidden along with the money. */
  notes: string | null;
};

/**
 * The month as a share link draws it: the dates, the names and the figure on
 * each bar. These are a client component's props on a page anybody holding
 * the link can open, so nothing rides along that the calendar does not draw.
 */
export type SharedCalendarTrip = Pick<Trip, "startDate" | "endDate" | "currency"> & {
  items: Pick<
    PublicTripItem,
    "id" | "title" | "category" | "scheduledOn" | "endsOn" | "cost"
  >[];
};

export type PublicTripView = {
  trip: Trip;
  /** With stops: a cruise's ports are half of what its row says. */
  items: PublicTripItem[];
  photos: TripPhoto[];
  share: TripShare;
  /**
   * Null when the link covers the whole trip, and on any link that hides
   * money — the scope is one traveller's bill, so without prices there is
   * nothing in it to show.
   */
  scope: PublicTripScope | null;
};

export type DashboardTravelTripState = "in_progress" | "upcoming" | "past";

export type DashboardTravelFeaturedTrip = Trip & {
  state: DashboardTravelTripState;
  itemCount: number;
  totalEstimate: number;
};

export type DashboardTravelSummary = {
  totalTrips: number;
  upcomingCount: number;
  inProgressCount: number;
  featured: DashboardTravelFeaturedTrip | null;
};
