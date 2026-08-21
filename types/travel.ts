import { tripItemCategoryEnum, tripPriceUnitEnum } from "@/db/schema";
import type {
  trips,
  tripItems,
  tripPhotos,
  tripShares,
} from "@/db/schema";

export type Trip = typeof trips.$inferSelect;
export type TripItem = typeof tripItems.$inferSelect;
export type TripPhoto = typeof tripPhotos.$inferSelect;
export type TripShare = typeof tripShares.$inferSelect;

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

export type TripItemWithStops = TripItem & { stops: TripItemStop[] };

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
};

// Aggregated view returned by the public share lookup. Carries only what the
// public renderer needs — never expose the full share token list of a trip,
// just the share that was actually used.
export type PublicTripView = {
  trip: Trip;
  items: TripItem[];
  photos: TripPhoto[];
  share: TripShare;
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
