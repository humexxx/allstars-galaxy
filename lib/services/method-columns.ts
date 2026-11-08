import "server-only";

import { eq, getTableColumns, sql } from "drizzle-orm";

import { investmentMethods } from "@/db/schema";

/**
 * A method's columns as `viewerUserId` may read them. `expected_monthly_roi`
 * is the owner's private expectation of what the capital earns — the other
 * half of their margin — so it comes back only on the viewer's own methods
 * and NULL on everyone else's (a client's portfolio reads method rows too).
 */
export function methodColumnsFor(viewerUserId: string | null) {
  const { expectedMonthlyRoi, ...rest } = getTableColumns(investmentMethods);
  return {
    ...rest,
    expectedMonthlyRoi: viewerUserId
      ? sql<string | null>`CASE WHEN ${eq(investmentMethods.ownerUserId, viewerUserId)} THEN ${expectedMonthlyRoi} END`
      : sql<string | null>`NULL`,
  };
}
