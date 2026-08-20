import type { TripItemCategory } from "@/types/travel";

/**
 * Which fields each kind of item actually needs, and what to call them.
 *
 * One form for every category meant every category carried every field, so a
 * flight asked for a video and a restaurant asked for an end date. Fields that
 * cannot apply are not disabled or explained — they are absent, because the
 * fastest form is the one with nothing to skip past.
 *
 * The labels change with the category for the same reason. "Check in" and
 * "Check out" are what a hotel has; "Day" and "End day" are what a hotel's
 * dates are called only by a database.
 */
export type ItemFieldSpec = {
  /** Airports, ports, stations. A hotel does not go anywhere. */
  route: boolean;
  /** Only meaningful where the same booking covers both directions. */
  roundTrip: boolean;
  endDay: boolean;
  /** A walkthrough of the room, a tour of the ship. Not of a taxi. */
  video: boolean;
  /** A day-by-day list of ports. Cruises only. */
  itinerary: boolean;
  startLabel: string;
  endLabel: string;
};

const DEFAULTS: ItemFieldSpec = {
  route: false,
  roundTrip: false,
  endDay: true,
  video: true,
  itinerary: false,
  startLabel: "Day",
  endLabel: "End day",
};

const BY_CATEGORY: Record<TripItemCategory, Partial<ItemFieldSpec>> = {
  lodging: { startLabel: "Check in", endLabel: "Check out" },
  flight: {
    route: true,
    roundTrip: true,
    // The return date IS the end day, but only once it is a return trip.
    endDay: false,
    video: false,
    startLabel: "Departs",
  },
  cruise: {
    route: true,
    itinerary: true,
    startLabel: "Boards",
    endLabel: "Disembarks",
  },
  transport: { route: true, endDay: false, video: false, startLabel: "Day" },
  food: { endDay: false },
  activity: {},
  shopping: { endDay: false, video: false },
  other: {},
};

export function itemFields(category: TripItemCategory): ItemFieldSpec {
  return { ...DEFAULTS, ...BY_CATEGORY[category] };
}

/**
 * A round trip borrows the end-day field for its return date, so the field
 * appears only when the flight actually returns.
 */
export function showsEndDay(spec: ItemFieldSpec, roundTrip: boolean): boolean {
  return spec.endDay || (spec.roundTrip && roundTrip);
}

export function endDayLabel(spec: ItemFieldSpec, roundTrip: boolean): string {
  return spec.roundTrip && roundTrip ? "Returns" : spec.endLabel;
}
