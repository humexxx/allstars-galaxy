import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

import { backfillAllOwners } from "@/lib/services/allocation-service";
import { setAppState } from "@/lib/services/app-state-service";
import { MASSIVE_CALLS_PER_RUN } from "@/lib/services/price-providers/massive";
import { refreshPrices } from "@/lib/services/price-service";

/**
 * Daily price refresh for the assets backing investment methods.
 *
 * Daily is what Vercel's Hobby plan schedules, and it matches what the free
 * data tiers actually sell: Massive's Basic plans are end-of-day, so a run
 * asks for yesterday's close and there is nothing finer to fetch. The endpoint
 * is frequency-agnostic — going hourly is a one-line change in vercel.json
 * once both the Vercel plan and the data plan justify it.
 *
 * Runs 30 minutes after the main daily job rather than alongside it, so the
 * two don't contend for the same pooled connections.
 */

// Providers are rate-limited (Massive: 5 req/min on the free tier), so a run
// with many individually-quoted tickers is slow rather than heavy.
export const maxDuration = 60;

const LAST_PRICE_RUN_KEY = "last_price_run";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const at = new Date().toISOString();
  try {
    // The backfill goes first and the refresh gets whatever is left of
    // Massive's five requests a minute. Pricing a contribution is the one
    // that cannot wait: a missed quote is retried tomorrow from the last
    // known price, while an unpriced contribution is money missing from the
    // margin. Most days the backfill has nothing to do and spends nothing.
    const { massiveCalls, ...backfill } = await backfillAllOwners();
    const result = await refreshPrices({
      massiveCalls: Math.max(0, MASSIVE_CALLS_PER_RUN - massiveCalls),
    });

    // Partial failures are reported, not thrown: one unpriced asset must not
    // discard the quotes that did land.
    const problems = [...backfill.errors, ...result.errors];
    await setAppState(LAST_PRICE_RUN_KEY, at, problems.length > 0 ? problems.join("; ") : null);

    return NextResponse.json({ ok: true, ...result, backfill, at });
  } catch (error) {
    console.error("Price cron error:", error);
    try {
      await setAppState(LAST_PRICE_RUN_KEY, at, messageOf(error));
    } catch (logError) {
      console.error("Failed to record the price run:", logError);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
