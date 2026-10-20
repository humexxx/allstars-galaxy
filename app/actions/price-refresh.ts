"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { refreshHeldPrices } from "@/lib/services/price-service";

export type PriceRefreshOutcome =
  /** Nothing newer exists yet; `newerAt` (ISO) is when it can. */
  | { status: "current"; newerAt: string | null }
  /** `missed` assets were asked for and did not come back. */
  | { status: "refreshed"; fetched: number; missed: number };

/**
 * Fetch fresh prices for the assets behind the caller's book, on demand.
 *
 * Owner-scoped by construction: the service only looks at contributions to
 * methods the effective user runs, so anyone else has nothing to refresh.
 */
export async function refreshPricesAction(): Promise<ActionResult<PriceRefreshOutcome>> {
  return safe<PriceRefreshOutcome>("price-refresh", async () => {
    const ctx = await requireEffectiveContext();
    const result = await refreshHeldPrices(ctx.effectiveUserId);

    switch (result.status) {
      case "nothing-held":
        return { success: false, error: "No priced holdings to refresh" };
      case "cooldown":
        return {
          success: false,
          error: `Prices were refreshed moments ago. Try again in ${minutesUntil(result.retryAt)} min.`,
        };
      case "current":
        return {
          success: true,
          data: { status: "current", newerAt: result.newerAt?.toISOString() ?? null },
        };
    }

    if (result.errors.length > 0) console.warn("Price refresh:", result.errors);
    if (result.fetched === 0) {
      return {
        success: false,
        error: "The price provider didn't answer. The last prices stay in place.",
      };
    }

    await logImpersonatedMutation({
      action: "priceQuotes.refresh",
      entityTable: "price_quotes",
      after: { fetched: result.fetched, skipped: result.skipped },
    });
    revalidatePath("/portal/portfolio");
    return {
      success: true,
      data: {
        status: "refreshed",
        fetched: result.fetched,
        missed: result.requested - result.fetched,
      },
    };
  });
}

function minutesUntil(when: Date): number {
  return Math.max(1, Math.ceil((when.getTime() - Date.now()) / 60_000));
}
