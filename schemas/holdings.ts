import { z } from "zod";

/**
 * A holding is a quantity, never a percentage. Percentages drift the moment a
 * price moves and would have to be recomputed on every quote; a quantity is
 * what is actually held, and its value falls out of quantity x price.
 */
export const upsertHoldingSchema = z.object({
  methodId: z.string().uuid(),
  assetId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than zero")
    .finite()
    // 8 decimals is the column's scale; more would be silently rounded by
    // Postgres and the UI would disagree with the database.
    .refine((n) => Number(n.toFixed(8)) === n, "At most 8 decimal places"),
  costBasis: z.coerce.number().min(0, "Cost basis cannot be negative").finite(),
  note: z.string().trim().max(280).optional().nullable(),
});

export const deleteHoldingSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Registering an asset the app can price.
 *
 * `externalId` is the provider's identifier and is NOT the symbol: CoinGecko
 * wants a coin id ("cardano"), Massive wants a ticker ("X:ADAUSD", "I:SPX").
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

export type UpsertHoldingInput = z.infer<typeof upsertHoldingSchema>;
export type DeleteHoldingInput = z.infer<typeof deleteHoldingSchema>;
export type CreatePriceAssetInput = z.infer<typeof createPriceAssetSchema>;
export type SetManualPriceInput = z.infer<typeof setManualPriceSchema>;
