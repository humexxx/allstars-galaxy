import { z } from "zod";

import { ALLOCATION_TOLERANCE } from "@/lib/finance/allocation";

/**
 * A method's investment policy: which assets incoming money is split across.
 *
 * Percentages, not quantities — the owner is declaring a rule ("every dollar
 * goes 100% into Cardano"), and the unit count falls out of applying that rule
 * to a real contribution at a real price.
 */
export const setAllocationsSchema = z
  .object({
    methodId: z.string().uuid(),
    allocations: z
      .array(
        z.object({
          assetId: z.string().uuid(),
          percent: z.coerce.number().gt(0, "Use a share above zero").max(100),
        })
      )
      .min(1, "Pick at least one asset"),
  })
  .refine(
    (v) =>
      Math.abs(v.allocations.reduce((s, a) => s + a.percent, 0) - 100) <=
      ALLOCATION_TOLERANCE,
    { message: "Shares must add up to 100%", path: ["allocations"] }
  )
  .refine(
    (v) => new Set(v.allocations.map((a) => a.assetId)).size === v.allocations.length,
    { message: "An asset can only appear once", path: ["allocations"] }
  );

/**
 * Registering an asset the app can price.
 *
 * `externalId` is the provider's identifier and is NOT the symbol: CoinGecko
 * wants a coin id ("cardano"), Massive wants a ticker ("X:ADAUSD", "SPY").
 * Getting this wrong is the single most common way a price silently never
 * arrives, so it is required for everything except manual assets.
 */
export const createPriceAssetSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((s) => s.toUpperCase()),
    name: z.string().trim().min(1).max(120),
    source: z.enum(["massive", "coingecko", "manual"]),
    externalId: z.string().trim().max(60).optional().nullable(),
  })
  .refine((v) => v.source === "manual" || !!v.externalId, {
    message: "A provider id is required unless the asset is priced manually",
    path: ["externalId"],
  });

/** Hand-pricing an asset no provider covers. */
export const setManualPriceSchema = z.object({
  assetId: z.string().uuid(),
  price: z.coerce.number().positive("Price must be greater than zero").finite(),
});

export type SetAllocationsInput = z.infer<typeof setAllocationsSchema>;
export type CreatePriceAssetInput = z.infer<typeof createPriceAssetSchema>;
export type SetManualPriceInput = z.infer<typeof setManualPriceSchema>;

/**
 * Editing a method you own.
 *
 * `monthlyRoi` is the fixed return promised to investors and the only figure
 * they ever see. It is also what `transactions.currentValue` compounds at, so
 * changing it moves what you owe — it is not a cosmetic field.
 */
export const updateMethodSchema = z.object({
  methodId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  // `author` is deliberately absent: it is the person who runs the method, so
  // it is derived from the owner server-side. Accepting it from the client
  // would let display credit drift away from who actually owns the thing.
  riskLevel: z.enum(["Low", "Medium", "High"]),
  monthlyRoi: z.coerce
    .number()
    .min(0, "A negative promised return makes no sense")
    .max(100, "That is a monthly percentage, not a multiplier")
    .finite(),
  enabled: z.boolean(),
});

export type UpdateMethodInput = z.infer<typeof updateMethodSchema>;
