import { z } from "zod";
import { embeddedVideo } from "@/lib/travel/video";
import { tripItemCategoryEnum, tripPriceUnitEnum } from "@/db/schema";
import { idSchema, isoDateSchema, moneySchema } from "@/schemas/common";

// ISO 4217 currency code, 3 uppercase letters.
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a 3-letter currency code (e.g. USD)");

// Derived from the pg enum rather than restated: the two lists were separate
// and adding a category to one silently rejected it in the other.
export const tripItemCategorySchema = z.enum(tripItemCategoryEnum.enumValues);

export const tripPhotoSourceSchema = z.enum(["upload", "url"]);

// ---------- trips ----------

export const createTripSchema = z
  .object({
    // A sentence, because the trip form prints it under the field.
    title: z.string().trim().min(1, "Give the trip a name").max(120),
    destination: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    coverPhotoUrl: z.url().max(2000).nullable().optional(),
    currency: currency.default("USD"),
    color: z.string().min(1).max(60).default("var(--chart-1)"),
  })
  .superRefine((val, ctx) => {
    if (val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
  });

export const updateTripSchema = z
  .object({
    id: idSchema,
    // A sentence, because the trip form prints it under the field.
    title: z.string().trim().min(1, "Give the trip a name").max(120),
    destination: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    coverPhotoUrl: z.url().max(2000).nullable().optional(),
    currency: currency.default("USD"),
    color: z.string().min(1).max(60).default("var(--chart-1)"),
  })
  .superRefine((val, ctx) => {
    if (val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
  });

// ---------- trip items ----------

export const tripItemBaseSchema = z.object({
  /** Members covering this item. Empty (or absent) = the trip's own split. */
  payerIds: z.array(idSchema).optional(),
  /** Members this item is for. Empty (or absent) = everybody on the trip. */
  attendeeIds: z.array(idSchema).optional(),
  title: z.string().min(1).max(200),
  category: tripItemCategorySchema.default("activity"),
  link: z.url().max(2000).nullable().optional(),
  // Validated as a link we can actually embed, not just any URL: the field
  // renders a player, so an unsupported address would save fine and then
  // silently show nothing.
  videoUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((v) => !v || embeddedVideo(v) !== null, {
      message: "Paste a YouTube or Instagram link",
    }),
  fromCode: z.string().trim().max(60).nullable().optional(),
  toCode: z.string().trim().max(60).nullable().optional(),
  roundTrip: z.boolean().optional(),
  price: moneySchema.nullable().optional(),
  priceMax: moneySchema.nullable().optional(),
  priceUnit: z.enum(tripPriceUnitEnum.enumValues).optional(),
  scheduledOn: isoDateSchema.nullable().optional(),
  endsOn: isoDateSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().optional(),
});

/**
 * A range stored backwards is not a typo the UI can absorb.
 *
 * The calendar derives a bar's width from `endsOn - scheduledOn`, so a
 * reversed range computes a negative span: the bar loses its column class
 * entirely and its lane is recorded as ending before it starts, which packs
 * the next run on top of it. Written once and applied to both the create and
 * the update schema — it lived only on the create one, which was itself never
 * imported, so nothing was checking either path.
 */
const endsAfterStart = (
  val: { scheduledOn?: string | null; endsOn?: string | null },
  ctx: z.RefinementCtx
) => {
  if (val.endsOn && val.scheduledOn && val.endsOn < val.scheduledOn) {
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "End day must be on or after the start day",
    });
  }
};

export const tripItemSchema = tripItemBaseSchema.superRefine(endsAfterStart);

export const updateTripItemSchema = tripItemBaseSchema
  .extend({ id: idSchema })
  .superRefine(endsAfterStart);

/**
 * Moving an item on the calendar sends only what moved.
 *
 * Not the whole item: the calendar renders from a snapshot, and echoing every
 * field back would overwrite a title or a price edited elsewhere since that
 * snapshot was taken with whatever the browser still believed.
 */
export const moveTripItemSchema = z
  .object({
    id: idSchema,
    scheduledOn: isoDateSchema,
    endsOn: isoDateSchema.nullable().optional(),
  })
  .superRefine(endsAfterStart);

// ---------- photos ----------

export const tripPhotoSchema = z.object({
  /**
   * Attaches the photo to one item instead of the trip's gallery.
   *
   * The column has existed since the table did; nothing ever sent it, so
   * every photo landed in the gallery whatever it was of.
   */
  itemId: idSchema.nullable().optional(),
  url: z.url().max(2000),
  storagePath: z.string().max(500).nullable().optional(),
  source: tripPhotoSourceSchema.default("url"),
  caption: z.string().max(500).nullable().optional(),
  sortOrder: z.number().optional(),
});

// ---------- shares ----------

export const createTripShareSchema = z.object({
  inviteeEmail: z.email().max(200).nullable().optional(),
  // Optional expiration. When null, the link is valid until revoked.
  expiresAt: z.coerce.date().nullable().optional(),
  // Scopes the link to one traveller. The service still checks the member
  // belongs to this trip — a foreign key alone would happily accept a member
  // id borrowed from somebody else's trip.
  memberId: idSchema.nullable().optional(),
  // A scoped link is pointless with the money hidden, so the caller says
  // outright what the recipient may see rather than inheriting a default that
  // contradicts the reason for the link.
  showPrices: z.boolean().optional(),
});

// ---------- contributions ----------

export const tripContributionSchema = z.object({
  memberId: idSchema,
  amount: moneySchema
    .refine((v) => parseFloat(v) > 0, "A payment of nothing is not a payment"),
  note: z.string().max(500).nullable().optional(),
  // Day, not timestamp: nobody remembers the hour they sent a transfer, and
  // storing one invites a timezone bug for no gain.
  paidOn: isoDateSchema.nullable().optional(),
});

/**
 * Editing a payment cannot move it to a different person.
 *
 * Reassigning would silently rewrite two balances at once — the one it left
 * and the one it landed on. Delete it and log it again, where both changes are
 * visible as what they are.
 */
export const updateTripContributionSchema = tripContributionSchema
  .omit({ memberId: true })
  .extend({ id: idSchema });

// `…Data` is what a schema produces (what services take). `…Input` exists only
// where a default or coercion makes the accepted shape looser than that — it
// is what the matching action takes, so a caller need not restate a default.
export type CreateTripData = z.infer<typeof createTripSchema>;
export type CreateTripInput = z.input<typeof createTripSchema>;
export type UpdateTripData = z.infer<typeof updateTripSchema>;
export type UpdateTripInput = z.input<typeof updateTripSchema>;
export type TripItemData = z.infer<typeof tripItemSchema>;
export type TripItemInput = z.input<typeof tripItemSchema>;
export type UpdateTripItemData = z.infer<typeof updateTripItemSchema>;
export type UpdateTripItemInput = z.input<typeof updateTripItemSchema>;
export type MoveTripItemData = z.infer<typeof moveTripItemSchema>;
export type TripPhotoData = z.infer<typeof tripPhotoSchema>;
export type TripPhotoInput = z.input<typeof tripPhotoSchema>;
export type CreateTripShareData = z.infer<typeof createTripShareSchema>;
export type CreateTripShareInput = z.input<typeof createTripShareSchema>;
export type TripContributionData = z.infer<typeof tripContributionSchema>;
export type UpdateTripContributionData = z.infer<typeof updateTripContributionSchema>;

/** Deleting a row that belongs to a trip: both ids, checked together. */
export const tripChildIdsSchema = z.object({ tripId: idSchema, childId: idSchema });
export type TripChildIdsData = z.infer<typeof tripChildIdsSchema>;

/**
 * An airport search. Bounded because the action is callable by anyone and
 * each query is scanned against ~7,900 rows; under two characters matches
 * too much to be useful.
 */
export const airportQuerySchema = z.string().trim().min(2).max(64);

/**
 * A cruise's stops, saved as a whole list rather than row by row.
 *
 * An itinerary is edited as one thing — you paste the operator's schedule and
 * fix a line — so a per-row API would mean a request per port and a half-saved
 * itinerary whenever one failed.
 */
export const setItemStopsSchema = z.object({
  itemId: idSchema,
  stops: z
    .array(
      z.object({
        dayNumber: z.coerce.number().int().min(1).max(365),
        stopOn: isoDateSchema.nullable().optional(),
        place: z.string().trim().min(1, "A stop needs a place").max(200),
        note: z.string().trim().max(200).nullable().optional(),
      })
    )
    .max(365)
    .refine(
      (rows) => new Set(rows.map((r) => r.dayNumber)).size === rows.length,
      { message: "Two stops cannot share a day number" }
    ),
});

export type SetItemStopsData = z.infer<typeof setItemStopsSchema>;

/**
 * The traveller list, saved whole.
 *
 * `email` is optional and, for now, informational — nothing is sent. A member
 * is not a user account: most travelling companions never sign in, and
 * requiring one would make the common case impossible.
 */
export const setTripMembersSchema = z.object({
  members: z
    .array(
      z.object({
        id: idSchema.optional(),
        name: z.string().trim().min(1, "A traveller needs a name").max(120),
        email: z.string().trim().email("That is not an email").max(200).nullable().optional(),
        sharePercent: z.coerce.number().min(0).max(100).nullable().optional(),
      })
    )
    .max(50)
    .refine(
      (rows) => {
        const fixed = rows.filter((r) => r.sharePercent !== null && r.sharePercent !== undefined);
        const total = fixed.reduce((sum, r) => sum + (r.sharePercent ?? 0), 0);
        // Fixed shares may total less than 100 — the rest is split equally —
        // but more than 100 has no meaning and would silently zero everyone else.
        return total <= 100.001;
      },
      { message: "Fixed shares cannot add up to more than 100%" }
    ),
});

export type SetTripMembersData = z.infer<typeof setTripMembersSchema>;
