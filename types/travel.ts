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

export type TripPhotoSource = "upload" | "url";

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

export type PublicTripView = {
  trip: Trip;
  /** With stops: a cruise's ports are half of what its row says. */
  items: TripItemWithStops[];
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
