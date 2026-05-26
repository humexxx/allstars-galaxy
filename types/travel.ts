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

export type TripItemCategory =
  | "lodging"
  | "transport"
  | "food"
  | "activity"
  | "shopping"
  | "other";

export type TripPhotoSource = "upload" | "url";

export type TripWithRelations = Trip & {
  items: TripItem[];
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
