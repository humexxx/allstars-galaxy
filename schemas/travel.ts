import { z } from "zod";

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

export const tripItemCategorySchema = z.enum([
  "lodging",
  "transport",
  "food",
  "activity",
  "shopping",
  "other",
]);

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
  price: price.nullable().optional(),
  scheduledOn: isoDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().optional(),
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
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type TripItemInput = z.infer<typeof tripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;
export type TripPhotoInput = z.infer<typeof tripPhotoSchema>;
export type CreateTripShareInput = z.infer<typeof createTripShareSchema>;
