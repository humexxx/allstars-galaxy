"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  backfillTransactionAllocations,
  setMethodAllocations,
  type BackfillResult,
} from "@/lib/services/allocation-service";
import {
  isAssetOnlyInOwnMethods,
  isMethodOwner,
  ownsAnyMethod,
  updateInvestmentMethod,
} from "@/lib/services/investment-method-service";
import {
  createPriceAsset,
  getPriceAsset,
  getPriceAssetBySymbol,
  insertManualQuote,
} from "@/lib/services/price-service";
import {
  createPriceAssetSchema,
  setAllocationsSchema,
  setManualPriceSchema,
  updateMethodSchema,
  type CreatePriceAssetInput,
  type SetAllocationsData,
  type SetManualPriceData,
  type UpdateMethodData,
} from "@/schemas/allocations";

const PORTFOLIO_PATH = "/portal/portfolio";

/**
 * Set a method's allocation policy.
 *
 * Only governs money arriving from now on. Contributions already priced keep
 * the units they bought — rewriting them would mean the owner's position
 * silently changed every time they revised the plan.
 */
export async function setAllocationsAction(
  input: SetAllocationsData
): Promise<ActionResult> {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setAllocationsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    if (!(await isMethodOwner(parsed.data.methodId, ctx.effectiveUserId))) {
      return { success: false, error: "Method not found" };
    }

    await setMethodAllocations(parsed.data.methodId, parsed.data.allocations);

    await logImpersonatedMutation({
      action: "methodAllocation.set",
      entityTable: "method_allocations",
      after: { methodId: parsed.data.methodId, allocations: parsed.data.allocations },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true };
  });
}

/**
 * Price any approved contribution that has no allocation rows yet, using the
 * asset's close on the day the money landed.
 */
export async function repriceContributionsAction(): Promise<ActionResult<BackfillResult>> {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    if (!(await ownsAnyMethod(ctx.effectiveUserId))) {
      return { success: false, error: "Not allowed" };
    }

    const result = await backfillTransactionAllocations(ctx.effectiveUserId);

    await logImpersonatedMutation({
      action: "transactionAllocation.backfill",
      entityTable: "transaction_allocations",
      after: { priced: result.priced, skipped: result.skipped },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true, data: result };
  });
}

/**
 * Add an asset to the catalogue the app can price.
 *
 * Open to anyone who owns a method: the catalogue is shared reference data
 * (a ticker and a provider id), not anybody's position.
 */
export async function createPriceAssetAction(
  input: CreatePriceAssetInput
): Promise<ActionResult<{ id: string }>> {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createPriceAssetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    if (!(await ownsAnyMethod(ctx.effectiveUserId))) {
      return { success: false, error: "Not allowed" };
    }

    const { symbol, name, source, externalId } = parsed.data;

    if (await getPriceAssetBySymbol(symbol)) {
      return { success: false, error: `${symbol} already exists` };
    }

    const created = await createPriceAsset({
      symbol,
      name,
      source,
      externalId: externalId || null,
    });

    await logImpersonatedMutation({
      action: "priceAsset.create",
      entityTable: "price_assets",
      after: { symbol, source, externalId },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true, data: created };
  });
}

/**
 * Price an asset by hand.
 *
 * Only for `manual` assets — a provider-quoted one would have the next cron
 * run contradict the hand-typed figure — and only when every method holding
 * the asset is the caller's own, or the caller is an admin acting as
 * themselves. A quote is shared: writing one for an asset another owner's
 * method holds would move THEIR margin.
 */
export async function setManualPriceAction(
  input: SetManualPriceData
): Promise<ActionResult> {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = setManualPriceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const asset = await getPriceAsset(parsed.data.assetId);
    if (!asset) {
      return { success: false, error: "Asset not found" };
    }
    if (asset.source !== "manual") {
      return { success: false, error: "Only manually priced assets take a hand-typed price" };
    }

    const isAdmin = ctx.realRole === "admin" && !ctx.isImpersonating;
    if (!isAdmin && !(await isAssetOnlyInOwnMethods(asset.id, ctx.effectiveUserId))) {
      return { success: false, error: "Not allowed" };
    }

    await insertManualQuote(asset.id, parsed.data.price);

    await logImpersonatedMutation({
      action: "priceAsset.manualQuote",
      entityTable: "price_quotes",
      after: { assetId: asset.id, price: parsed.data.price },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true };
  });
}

/**
 * Edit a method you own.
 *
 * Ownership, not admin: a method is somebody's product, and the person who
 * runs it is the one who gets to change what it promises.
 */
export async function updateMethodAction(
  input: UpdateMethodData
): Promise<ActionResult> {
  return safe("allocations", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateMethodSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { methodId, name, description, riskLevel, monthlyRoi, enabled } = parsed.data;

    const updated = await updateInvestmentMethod(methodId, ctx.effectiveUserId, {
      name,
      description: description || null,
      riskLevel,
      monthlyRoi,
      enabled,
    });
    if (!updated) {
      return { success: false, error: "Method not found" };
    }

    await logImpersonatedMutation({
      action: "investmentMethod.update",
      entityTable: "investment_methods",
      entityId: methodId,
      before: { name: updated.before.name, monthlyRoi: updated.before.monthlyRoi },
      after: { name, monthlyRoi },
    });
    revalidatePath(PORTFOLIO_PATH);
    return { success: true };
  });
}
