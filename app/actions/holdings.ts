"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { investmentMethods, methodHoldings, priceAssets, priceQuotes } from "@/db/schema";
import { safe } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  createPriceAssetSchema,
  deleteHoldingSchema,
  setManualPriceSchema,
  upsertHoldingSchema,
  type CreatePriceAssetInput,
  type DeleteHoldingInput,
  type SetManualPriceInput,
  type UpsertHoldingInput,
} from "@/schemas/holdings";

const PORTFOLIO_PATH = "/portal/portfolio";

/**
 * Where the pooled capital actually sits is the owner's private business: it
 * is the other half of the margin, and investors only ever see the fixed
 * return they were promised. Ownership of the method — not merely being an
 * admin — is the gate.
 */
async function assertOwnsMethod(methodId: string, userId: string): Promise<boolean> {
  const [method] = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(and(eq(investmentMethods.id, methodId), eq(investmentMethods.ownerUserId, userId)))
    .limit(1);
  return !!method;
}

export async function upsertHoldingAction(input: UpsertHoldingInput) {
  return safe("holdings", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = upsertHoldingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }
    const { methodId, assetId, quantity, costBasis, note } = parsed.data;

    if (!(await assertOwnsMethod(methodId, ctx.effectiveUserId))) {
      return { success: false as const, error: "Method not found" };
    }

    await db
      .insert(methodHoldings)
      .values({
        methodId,
        assetId,
        quantity: quantity.toFixed(8),
        costBasis: costBasis.toFixed(2),
        note: note ?? null,
      })
      // One row per (method, asset) — re-adding an asset edits the position
      // instead of creating a duplicate the margin would then double-count.
      .onConflictDoUpdate({
        target: [methodHoldings.methodId, methodHoldings.assetId],
        set: {
          quantity: quantity.toFixed(8),
          costBasis: costBasis.toFixed(2),
          note: note ?? null,
          updatedAt: new Date(),
        },
      });

    await logImpersonatedMutation({
      action: "methodHolding.upsert",
      entityTable: "method_holdings",
      after: { methodId, assetId, quantity },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const };
  });
}

export async function deleteHoldingAction(input: DeleteHoldingInput) {
  return safe("holdings", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = deleteHoldingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }

    const [holding] = await db
      .select({ id: methodHoldings.id, methodId: methodHoldings.methodId })
      .from(methodHoldings)
      .where(eq(methodHoldings.id, parsed.data.id))
      .limit(1);

    if (!holding || !(await assertOwnsMethod(holding.methodId, ctx.effectiveUserId))) {
      return { success: false as const, error: "Holding not found" };
    }

    await db.delete(methodHoldings).where(eq(methodHoldings.id, parsed.data.id));

    await logImpersonatedMutation({
      action: "methodHolding.delete",
      entityTable: "method_holdings",
      before: { id: holding.id, methodId: holding.methodId },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const };
  });
}

/**
 * Add an asset to the catalogue the app can price.
 *
 * Open to anyone who owns a method: the catalogue is shared reference data
 * (a ticker and a provider id), not anybody's position.
 */
export async function createPriceAssetAction(input: CreatePriceAssetInput) {
  return safe("holdings", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createPriceAssetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const [owned] = await db
      .select({ id: investmentMethods.id })
      .from(investmentMethods)
      .where(eq(investmentMethods.ownerUserId, ctx.effectiveUserId))
      .limit(1);
    if (!owned) {
      return { success: false as const, error: "Not allowed" };
    }

    const { symbol, name, source, externalId } = parsed.data;

    const [existing] = await db
      .select({ id: priceAssets.id })
      .from(priceAssets)
      .where(eq(priceAssets.symbol, symbol))
      .limit(1);
    if (existing) {
      return { success: false as const, error: `${symbol} already exists` };
    }

    const [created] = await db
      .insert(priceAssets)
      .values({ symbol, name, source, externalId: externalId || null })
      .returning({ id: priceAssets.id });

    await logImpersonatedMutation({
      action: "priceAsset.create",
      entityTable: "price_assets",
      after: { symbol, source, externalId },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const, data: { id: created.id } };
  });
}

/**
 * Price an asset by hand.
 *
 * Writes an ordinary quote row, so a manual price and a fetched one are the
 * same kind of fact and the margin reads them identically.
 */
export async function setManualPriceAction(input: SetManualPriceInput) {
  return safe("holdings", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setManualPriceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const [owned] = await db
      .select({ id: investmentMethods.id })
      .from(investmentMethods)
      .where(eq(investmentMethods.ownerUserId, ctx.effectiveUserId))
      .limit(1);
    if (!owned) {
      return { success: false as const, error: "Not allowed" };
    }

    await db.insert(priceQuotes).values({
      assetId: parsed.data.assetId,
      price: parsed.data.price.toFixed(8),
    });

    await logImpersonatedMutation({
      action: "priceAsset.manualQuote",
      entityTable: "price_quotes",
      after: { assetId: parsed.data.assetId, price: parsed.data.price },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const };
  });
}
