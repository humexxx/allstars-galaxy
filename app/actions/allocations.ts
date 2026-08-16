"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { investmentMethods, priceAssets, priceQuotes, users } from "@/db/schema";
import { safe } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  backfillTransactionAllocations,
  setMethodAllocations,
} from "@/lib/services/allocation-service";
import {
  createPriceAssetSchema,
  setAllocationsSchema,
  setManualPriceSchema,
  type CreatePriceAssetInput,
  type SetAllocationsInput,
  type SetManualPriceInput,
  updateMethodSchema,
  type UpdateMethodInput,
} from "@/schemas/allocations";

const PORTFOLIO_PATH = "/portal/portfolio";

/**
 * Where the pooled capital goes is the owner's private business: it is the
 * other half of the margin, and investors only ever see the fixed return they
 * were promised. Ownership of the method — not merely being an admin — is the
 * gate.
 */
async function ownsMethod(methodId: string, userId: string): Promise<boolean> {
  const [method] = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(and(eq(investmentMethods.id, methodId), eq(investmentMethods.ownerUserId, userId)))
    .limit(1);
  return !!method;
}

async function ownsAnyMethod(userId: string): Promise<boolean> {
  const [method] = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, userId))
    .limit(1);
  return !!method;
}

/**
 * Set a method's allocation policy.
 *
 * Only governs money arriving from now on. Contributions already priced keep
 * the units they bought — rewriting them would mean the owner's position
 * silently changed every time they revised the plan.
 */
export async function setAllocationsAction(input: SetAllocationsInput) {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setAllocationsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    if (!(await ownsMethod(parsed.data.methodId, ctx.effectiveUserId))) {
      return { success: false as const, error: "Method not found" };
    }

    await setMethodAllocations(parsed.data.methodId, parsed.data.allocations);

    await logImpersonatedMutation({
      action: "methodAllocation.set",
      entityTable: "method_allocations",
      after: { methodId: parsed.data.methodId, allocations: parsed.data.allocations },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const };
  });
}

/**
 * Price any approved contribution that has no allocation rows yet, using the
 * asset's close on the day the money landed.
 */
export async function repriceContributionsAction() {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    if (!(await ownsAnyMethod(ctx.effectiveUserId))) {
      return { success: false as const, error: "Not allowed" };
    }

    const result = await backfillTransactionAllocations(ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "transactionAllocation.backfill",
      entityTable: "transaction_allocations",
      after: { priced: result.priced, skipped: result.skipped },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const, data: result };
  });
}

/**
 * Add an asset to the catalogue the app can price.
 *
 * Open to anyone who owns a method: the catalogue is shared reference data
 * (a ticker and a provider id), not anybody's position.
 */
export async function createPriceAssetAction(input: CreatePriceAssetInput) {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createPriceAssetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }
    if (!(await ownsAnyMethod(ctx.effectiveUserId))) {
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
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setManualPriceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }
    if (!(await ownsAnyMethod(ctx.effectiveUserId))) {
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

/**
 * Edit a method you own.
 *
 * Ownership, not admin: a method is somebody's product, and the person who
 * runs it is the one who gets to change what it promises.
 */
export async function updateMethodAction(input: UpdateMethodInput) {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateMethodSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0].message };
    }

    const { methodId, name, description, riskLevel, monthlyRoi, enabled } = parsed.data;

    if (!(await ownsMethod(methodId, ctx.effectiveUserId))) {
      return { success: false as const, error: "Method not found" };
    }

    const [before] = await db
      .select()
      .from(investmentMethods)
      .where(eq(investmentMethods.id, methodId))
      .limit(1);

    // Credit follows ownership. Falls back to whatever was already there if the
    // owner has no name on file, so an edit never blanks the field.
    const [owner] = await db
      .select({ fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, ctx.effectiveUserId))
      .limit(1);
    const author =
      owner?.fullName || owner?.email?.split("@")[0] || before?.author || "Unknown";

    await db
      .update(investmentMethods)
      .set({
        name,
        description: description || null,
        author,
        riskLevel,
        monthlyRoi: monthlyRoi.toFixed(4),
        enabled,
      })
      .where(eq(investmentMethods.id, methodId));

    await logImpersonatedMutation({
      action: "investmentMethod.update",
      entityTable: "investment_methods",
      before: before ? { name: before.name, monthlyRoi: before.monthlyRoi } : undefined,
      after: { name, monthlyRoi },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true as const };
  });
}
