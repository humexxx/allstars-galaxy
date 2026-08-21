import type { TripItemCategory, TripPriceUnit } from "@/types/travel";

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
  /** Whether to ask for a title, or derive one from the fields that matter. */
  title: boolean;
  /** What a price of this kind is usually per, so the common case is preset. */
  defaultPriceUnit: TripPriceUnit;
  /**
   * The units this kind of price can honestly be quoted in.
   *
   * `per_night` multiplies by the nights between the start and end day, so it
   * only belongs where the end day marks a stay you sleep through. A flight's
   * end day is its return date — offering "per night" there would multiply one
   * fare by every night of the trip.
   */
  priceUnits: TripPriceUnit[];
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
  title: true,
  defaultPriceUnit: "total",
  priceUnits: ["total", "per_person"],
  route: false,
  roundTrip: false,
  endDay: true,
  video: true,
  itinerary: false,
  startLabel: "Day",
  endLabel: "End day",
};

const BY_CATEGORY: Record<TripItemCategory, Partial<ItemFieldSpec>> = {
  lodging: {
    startLabel: "Check in",
    endLabel: "Check out",
    defaultPriceUnit: "per_night",
    priceUnits: ["per_night", "total", "per_person"],
  },
  flight: {
    route: true,
    roundTrip: true,
    // The return date IS the end day, but only once it is a return trip.
    endDay: false,
    video: false,
    startLabel: "Departs",
    // Airlines quote per traveller, but what lands in this field is the
    // number off the checkout page — one booking for everybody flying. The
    // per-person default silently doubled a two-person trip's flights, which
    // is the wrong direction to be wrong in.
    defaultPriceUnit: "total",
    // A flight already says what it is: two airports and a direction. Asking
    // for a title on top invites "Flight to Orlando" next to "SJO → MCO",
    // which is the same sentence twice and can fall out of step with the route.
    title: false,
  },
  cruise: {
    route: true,
    itinerary: true,
    startLabel: "Boards",
    endLabel: "Disembarks",
    defaultPriceUnit: "per_person",
    // Boards → disembarks is a stay, so a nightly rate is a real way to
    // compare two sailings.
    priceUnits: ["per_person", "total", "per_night"],
  },
  transport: { route: true, endDay: false, video: false, startLabel: "Day" },
  food: { endDay: false },
  activity: {},
  shopping: { endDay: false, video: false },
  // The escape hatch: whatever does not fit a category keeps every unit,
  // including nightly for a campsite or a car held for the week.
  other: { priceUnits: ["total", "per_person", "per_night"] },
};

export function itemFields(category: TripItemCategory): ItemFieldSpec {
  return { ...DEFAULTS, ...BY_CATEGORY[category] };
}

/**
 * The units to offer for a category, keeping whatever is already stored.
 *
 * An item saved before its category narrowed — or moved from one category to
 * another — must still show the unit it is actually priced in. Dropping it
 * from the list would blank the control while the old value stayed in the
 * database, and the price on screen would no longer explain itself.
 */
export function priceUnitOptions(
  category: TripItemCategory,
  current?: TripPriceUnit | null
): TripPriceUnit[] {
  const allowed = itemFields(category).priceUnits;
  return current && !allowed.includes(current) ? [...allowed, current] : allowed;
}

/** Whether a saved unit still makes sense for the category it now sits in. */
export function allowsPriceUnit(
  category: TripItemCategory,
  unit: TripPriceUnit
): boolean {
  return itemFields(category).priceUnits.includes(unit);
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


/**
 * A title for the kinds of item that do not need one asked for.
 *
 * Falls back to the category's own word when the fields it derives from are
 * still empty, so a half-filled form never saves an empty title.
 */
export function deriveTitle(
  category: TripItemCategory,
  fields: { fromCode?: string | null; toCode?: string | null; roundTrip?: boolean },
  fallback: string
): string {
  const from = fields.fromCode?.trim();
  const to = fields.toCode?.trim();
  if (from && to) return `${from} ${fields.roundTrip ? "⇄" : "→"} ${to}`;
  if (from || to) return `${fallback} ${from ? `from ${from}` : `to ${to}`}`;
  return fallback;
}
