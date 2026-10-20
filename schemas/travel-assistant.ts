import { z } from "zod";

import { tripPriceUnitEnum } from "@/db/schema";
import { idSchema, isoDateSchema, moneySchema } from "@/schemas/common";
import { tripItemCategorySchema } from "@/schemas/travel";

/**
 * What the travel assistant may propose, and what Apply re-checks.
 *
 * Fields are patches over the existing rows, never whole rows: the model only
 * names what it is changing, and the service merges that over what is stored
 * before validating the result with the same schemas the forms use. The
 * descriptions are read by the model — they are the tool's documentation.
 */

/** The model writes 450 as often as "450.00"; both land as the column's string. */
const money = z
  .union([z.number().nonnegative(), moneySchema])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v));

const tripFields = z.object({
  title: z.string().trim().min(1).max(120).describe('Short trip name, e.g. "Orlando"'),
  destination: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .describe('Where, e.g. "Orlando, Florida"'),
  description: z.string().max(2000).nullable().optional(),
  startDate: isoDateSchema.describe("First day, YYYY-MM-DD"),
  endDate: isoDateSchema
    .nullable()
    .optional()
    .describe("Last day, YYYY-MM-DD. Null for an open-ended trip"),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .describe("ISO 4217 code the trip's prices are in. USD when the user does not say"),
  coverPhotoUrl: z
    .url()
    .max(2000)
    .nullable()
    .optional()
    .describe("The trip's cover picture: an image the user attached, or a link they gave"),
});

const itemFields = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('What it is, e.g. "Hotel Bairro Alto". For a flight, "SJO → MCO"'),
  category: tripItemCategorySchema.describe(
    "lodging, flight, cruise, transport, food, activity, shopping or other"
  ),
  scheduledOn: isoDateSchema
    .nullable()
    .optional()
    .describe("The day it happens. Lodging: check-in. Flight: departure. Cruise: boarding"),
  endsOn: isoDateSchema
    .nullable()
    .optional()
    .describe(
      "Lodging: check-out. Cruise: disembarking. A multi-day activity: its last day. A round-trip flight: the return day. Otherwise leave empty"
    ),
  fromCode: z
    .string()
    .trim()
    .max(60)
    .nullable()
    .optional()
    .describe("Flights, cruises and transport: where from — an airport code like SJO, or a place"),
  toCode: z.string().trim().max(60).nullable().optional().describe("Where to, like fromCode"),
  roundTrip: z
    .boolean()
    .optional()
    .describe("Flights only: one booking that also comes back, on endsOn"),
  price: money.nullable().optional().describe("The price, or the low end of an estimate"),
  priceMax: money.nullable().optional().describe("The high end of an estimate"),
  priceUnit: z
    .enum(tripPriceUnitEnum.enumValues)
    .optional()
    .describe(
      "What the price is per: total (the default), per_night (lodging, cruise, other) or per_person"
    ),
  link: z.url().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  attendeeIds: z
    .array(idSchema)
    .optional()
    .describe("Ids of the trip members this is for. Omit for everybody"),
  payerIds: z
    .array(idSchema)
    .optional()
    .describe("Ids of the trip members who pay for it, equally. Omit for the trip's usual split"),
  attendeeNames: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Or name them: members' names, including ones added earlier in this proposal"),
  payerNames: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Or name who pays, the same way"),
});

const memberFields = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200).nullable().optional(),
  sharePercent: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional()
    .describe("A fixed share of the trip's cost, 0-100. Omit to split what is left equally"),
});

/** A path the browser's own upload produced: `<user id>/<folder>/<file>`. */
const storagePath = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[\w-]+\/[\w.-]+$/, "Not an uploaded file's path");

const photoFields = z.object({
  url: z.url().max(2000),
  storagePath: storagePath
    .optional()
    .describe("Only for an image the user attached: the storagePath its note gives"),
  caption: z.string().max(500).nullable().optional(),
  itemId: idSchema.optional().describe("Put it on one item instead of the trip's gallery"),
});

const createTripChange = z.object({
  op: z.literal("create_trip"),
  ref: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe("Your label for the new trip, so add_item in this proposal can name it as tripRef"),
  trip: tripFields,
});

const updateTripChange = z.object({
  op: z.literal("update_trip"),
  tripId: idSchema,
  changes: tripFields.partial().describe("Only the fields that change"),
});

const deleteTripChange = z.object({ op: z.literal("delete_trip"), tripId: idSchema });

const addItemChange = z.object({
  op: z.literal("add_item"),
  tripId: idSchema.optional().describe("An existing trip"),
  tripRef: z.string().optional().describe("Or the ref of a trip created earlier in this proposal"),
  item: itemFields,
});

const updateItemChange = z.object({
  op: z.literal("update_item"),
  tripId: idSchema,
  itemId: idSchema,
  changes: itemFields.partial().describe("Only the fields that change"),
});

const deleteItemChange = z.object({
  op: z.literal("delete_item"),
  tripId: idSchema,
  itemId: idSchema,
});

const tripTarget = {
  tripId: idSchema.optional().describe("An existing trip"),
  tripRef: z.string().optional().describe("Or the ref of a trip created earlier in this proposal"),
};

const addMemberChange = z.object({ op: z.literal("add_member"), ...tripTarget, member: memberFields });

const updateMemberChange = z.object({
  op: z.literal("update_member"),
  tripId: idSchema,
  memberId: idSchema,
  changes: memberFields.partial(),
});

const removeMemberChange = z.object({
  op: z.literal("remove_member"),
  tripId: idSchema,
  memberId: idSchema,
});

const addPhotoChange = z.object({ op: z.literal("add_photo"), ...tripTarget, photo: photoFields });

const removePhotoChange = z.object({
  op: z.literal("remove_photo"),
  tripId: idSchema,
  photoId: idSchema,
});

/**
 * Money a traveller has already handed over — logged here, not moved: the app
 * keeps the record, the transfer happens wherever it happens.
 */
const paymentFields = z.object({
  memberId: idSchema.optional().describe("Who paid"),
  memberName: z.string().trim().min(1).optional().describe("Or name who paid"),
  amount: money.describe("How much, in the trip's currency"),
  paidOn: isoDateSchema.nullable().optional().describe("The day they paid; today when unsaid"),
  note: z.string().max(500).nullable().optional(),
});

const addPaymentChange = z.object({ op: z.literal("add_payment"), ...tripTarget, payment: paymentFields });

const updatePaymentChange = z.object({
  op: z.literal("update_payment"),
  tripId: idSchema,
  paymentId: idSchema,
  // Not who paid: moving a payment rewrites two balances at once. Remove it
  // and log it again instead, as the app's own form insists.
  changes: paymentFields.pick({ amount: true, paidOn: true, note: true }).partial(),
});

const removePaymentChange = z.object({
  op: z.literal("remove_payment"),
  tripId: idSchema,
  paymentId: idSchema,
});

export const travelChangeSchema = z.discriminatedUnion("op", [
  createTripChange,
  updateTripChange,
  deleteTripChange,
  addItemChange,
  updateItemChange,
  deleteItemChange,
  addMemberChange,
  updateMemberChange,
  removeMemberChange,
  addPhotoChange,
  removePhotoChange,
  addPaymentChange,
  updatePaymentChange,
  removePaymentChange,
]);

export const travelChangeSetSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('One line the user reads on the proposal card, e.g. "Orlando, Jan 16–24, with 6 bookings"'),
    changes: z.array(travelChangeSchema).min(1).max(60),
  })
  .superRefine((set, ctx) => {
    const refs = new Set<string>();
    set.changes.forEach((change, index) => {
      if (change.op === "create_trip") {
        if (refs.has(change.ref)) {
          ctx.addIssue({ code: "custom", path: ["changes", index, "ref"], message: `Duplicate trip ref "${change.ref}"` });
        }
        refs.add(change.ref);
      }
      if (change.op === "add_payment" && Boolean(change.payment.memberId) === Boolean(change.payment.memberName)) {
        ctx.addIssue({ code: "custom", path: ["changes", index, "payment"], message: "A payment needs either memberId or memberName" });
      }
      if (
        change.op === "add_item" ||
        change.op === "add_member" ||
        change.op === "add_photo" ||
        change.op === "add_payment"
      ) {
        // Exactly one, and a ref only once it exists: changes run in order.
        if (Boolean(change.tripId) === Boolean(change.tripRef)) {
          ctx.addIssue({ code: "custom", path: ["changes", index], message: `${change.op} needs either tripId or tripRef` });
        } else if (change.tripRef && !refs.has(change.tripRef)) {
          ctx.addIssue({
            code: "custom",
            path: ["changes", index, "tripRef"],
            message: `No trip with ref "${change.tripRef}" is created before this change`,
          });
        }
      }
    });
  });

export type TravelChangeData = z.infer<typeof travelChangeSchema>;
export type TravelChangeSetData = z.infer<typeof travelChangeSetSchema>;
export type TravelChangeSetInput = z.input<typeof travelChangeSetSchema>;

/** The undo receipt Apply hands back: opaque to the browser, signed by the server. */
export const travelUndoTokenSchema = z.string().min(1).max(2_000_000);
