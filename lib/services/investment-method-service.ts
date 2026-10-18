import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { investmentMethods, methodAllocations } from "@/db/schema";
import type { InvestmentMethodOption } from "@/types/finance";
import type { InvestmentMethod } from "@/types/portfolio";

/** Every method in the catalogue, enabled or not — callers filter. */
export async function listAllInvestmentMethods(): Promise<InvestmentMethod[]> {
  return db.select().from(investmentMethods);
}

/**
 * Where the pooled capital goes is the owner's private business: it is the
 * other half of the margin, and investors only ever see the fixed return they
 * were promised. Ownership of the method — not merely being an admin — is the
 * gate.
 */
export async function isMethodOwner(methodId: string, userId: string): Promise<boolean> {
  const [method] = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(and(eq(investmentMethods.id, methodId), eq(investmentMethods.ownerUserId, userId)))
    .limit(1);
  return !!method;
}

export async function ownsAnyMethod(userId: string): Promise<boolean> {
  const [method] = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, userId))
    .limit(1);
  return !!method;
}

/**
 * Whether `userId` is the only person whose methods route money into this
 * asset. A price is shared reference data: a quote written for an asset that
 * somebody else's method also holds would move THEIR margin too.
 */
export async function isAssetOnlyInOwnMethods(
  assetId: string,
  userId: string
): Promise<boolean> {
  const rows = await db
    .select({ ownerUserId: investmentMethods.ownerUserId })
    .from(methodAllocations)
    .innerJoin(investmentMethods, eq(methodAllocations.methodId, investmentMethods.id))
    .where(eq(methodAllocations.assetId, assetId));
  return rows.length > 0 && rows.every((r) => r.ownerUserId === userId);
}

export type InvestmentMethodUpdate = {
  name: string;
  description: string | null;
  riskLevel: InvestmentMethod["riskLevel"];
  /** Percent per month, e.g. 0.7 for 0.7%. */
  monthlyRoi: number;
  enabled: boolean;
};

/**
 * Edit a method, scoped to its owner in the WHERE itself — a pre-check
 * followed by an id-only update would let a change of owner in between slip
 * through. Null when the method does not exist or is not theirs.
 */
export async function updateInvestmentMethod(
  methodId: string,
  ownerUserId: string,
  data: InvestmentMethodUpdate
): Promise<{ before: InvestmentMethod; after: InvestmentMethod } | null> {
  const owned = and(
    eq(investmentMethods.id, methodId),
    eq(investmentMethods.ownerUserId, ownerUserId)
  );

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(investmentMethods).where(owned).limit(1);
    if (!before) return null;

    const [after] = await tx
      .update(investmentMethods)
      .set({
        name: data.name,
        description: data.description,
        riskLevel: data.riskLevel,
        monthlyRoi: data.monthlyRoi.toFixed(4),
        enabled: data.enabled,
        updatedAt: new Date(),
      })
      .where(owned)
      .returning();
    return after ? { before, after } : null;
  });
}

export async function listInvestmentMethods(
  options: { includeDisabled?: boolean } = {}
): Promise<InvestmentMethodOption[]> {
  const rows = await db
    .select({
      id: investmentMethods.id,
      name: investmentMethods.name,
      monthlyRoi: investmentMethods.monthlyRoi,
      enabled: investmentMethods.enabled,
    })
    .from(investmentMethods)
    .orderBy(asc(investmentMethods.name));
  return options.includeDisabled ? rows : rows.filter((r) => r.enabled);
}
