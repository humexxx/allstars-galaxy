import { z } from "zod";
import { embeddedVideo } from "@/lib/travel/video";
import { tripItemCategoryEnum, tripPriceUnitEnum } from "@/db/schema";

// Non-negative monetary value (no leading minus). Mirrors the CHECK constraint
// on trip_items.price.
const price = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative number with up to 2 decimals");

// ISO date string YYYY-MM-DD. Postgres date columns are calendar-day-only.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date");

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
    title: z.string().min(1).max(120),
    destination: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    coverPhotoUrl: z.string().url().max(2000).nullable().optional(),
    currency: currency.default("USD"),
    color: z.string().min(1).max(60).default("var(--chart-1)"),
  })
  .superRefine((val, ctx) => {
    if (val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
  });

export const updateTripSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120),
    destination: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    coverPhotoUrl: z.string().url().max(2000).nullable().optional(),
    // Validated as a YouTube link specifically, not just any URL: the field
    // renders an embed, and a non-YouTube address would save fine and then
    // silently show nothing.
    currency: currency.default("USD"),
    color: z.string().min(1).max(60).default("var(--chart-1)"),
  })
  .superRefine((val, ctx) => {
    if (val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
  });

// ---------- trip items ----------

export const tripItemSchema = z.object({
  title: z.string().min(1).max(200),
  category: tripItemCategorySchema.default("activity"),
  link: z.string().url().max(2000).nullable().optional(),
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
  price: price.nullable().optional(),
  priceMax: price.nullable().optional(),
  priceUnit: z.enum(tripPriceUnitEnum.enumValues).optional(),
  scheduledOn: isoDate.nullable().optional(),
  endsOn: isoDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().optional(),
});

export const tripItemSchemaChecked = tripItemSchema.superRefine((val, ctx) => {
  if (val.endsOn && val.scheduledOn && val.endsOn < val.scheduledOn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsOn"],
      message: "End day must be on or after the start day",
    });
  }
});

export const updateTripItemSchema = tripItemSchema.extend({
  id: z.string().uuid(),
});

// ---------- photos ----------

export const tripPhotoSchema = z.object({
  url: z.string().url().max(2000),
  storagePath: z.string().max(500).nullable().optional(),
  source: tripPhotoSourceSchema.default("url"),
  caption: z.string().max(500).nullable().optional(),
  sortOrder: z.number().optional(),
});

// ---------- shares ----------

export const createTripShareSchema = z.object({
  inviteeEmail: z.string().email().max(200).nullable().optional(),
  // Optional expiration. When null, the link is valid until revoked.
  expiresAt: z.coerce.date().nullable().optional(),
  // Scopes the link to one traveller. The service still checks the member
  // belongs to this trip — a foreign key alone would happily accept a member
  // id borrowed from somebody else's trip.
  memberId: z.string().uuid().nullable().optional(),
  // A scoped link is pointless with the money hidden, so the caller says
  // outright what the recipient may see rather than inheriting a default that
  // contradicts the reason for the link.
  showPrices: z.boolean().optional(),
});

// ---------- contributions ----------

export const tripContributionSchema = z.object({
  memberId: z.string().uuid(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a non-negative number")
    .refine((v) => parseFloat(v) > 0, "A payment of nothing is not a payment"),
  note: z.string().max(500).nullable().optional(),
  // Day, not timestamp: nobody remembers the hour they sent a transfer, and
  // storing one invites a timezone bug for no gain.
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
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
  .extend({ id: z.string().uuid() });

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TripItemInput = z.infer<typeof tripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;
export type TripPhotoInput = z.infer<typeof tripPhotoSchema>;
export type CreateTripShareInput = z.infer<typeof createTripShareSchema>;
export type UpdateTripContributionInput = z.infer<typeof updateTripContributionSchema>;
export type TripContributionInput = z.infer<typeof tripContributionSchema>;

/**
 * A cruise's stops, saved as a whole list rather than row by row.
 *
 * An itinerary is edited as one thing — you paste the operator's schedule and
 * fix a line — so a per-row API would mean a request per port and a half-saved
 * itinerary whenever one failed.
 */
export const setItemStopsSchema = z.object({
  itemId: z.string().uuid(),
  stops: z
    .array(
      z.object({
        dayNumber: z.coerce.number().int().min(1).max(365),
        stopOn: isoDate.nullable().optional(),
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
        id: z.string().uuid().optional(),
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
