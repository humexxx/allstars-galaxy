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
 * What the month calendar reads. The planner passes its whole trip; the
 * public page builds one from the share view, which has no member list to
 * give and must not carry the owner's id into a page anybody can open.
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
 * pointless if the data it hides still arrived in the payload.
 */
export type PublicTripScope = {
  memberName: string;
  /** What each item costs THIS traveller, keyed by item id. */
  lines: { itemId: string; low: number; high: number }[];
  owedLow: number;
  owedHigh: number;
  /** What they have handed over so far. */
  paid: number;
};

/**
 * An item as a public link may see it.
 *
 * `payerIds` and `attendeeIds` are deliberately absent: they are raw
 * `trip_members` UUIDs, a public link is unauthenticated, and a scoped one
 * exists precisely to keep the other travellers out of the payload. The
 * service uses both lists to narrow and to split, then drops them.
 */
export type PublicTripItem = Omit<TripItemWithStops, "payerIds" | "attendeeIds"> & {
  /**
   * What the item costs the whole party, worked out on the server where the
   * party size and the attendee lists are known. The page used to re-cost
   * items itself with a party of one — a $95-per-person train for four read
   * $95, the trip total came out thousands short of the planner's, and a
   * five-night hotel printed its five-night figure over "/ night".
   */
  cost: PublicItemCost;
};

/** An item's cost with its unit applied, and how many times it applied. */
export type PublicItemCost = { low: number; high: number; times: number };

export type PublicTripView = {
  trip: Trip;
  /** With stops: a cruise's ports are half of what its row says. */
  items: PublicTripItem[];
  photos: TripPhoto[];
  share: TripShare;
  /** Null when the link covers the whole trip. */
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
