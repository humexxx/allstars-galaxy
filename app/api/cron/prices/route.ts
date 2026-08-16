import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { refreshPrices } from "@/lib/services/price-service";

/**
 * Hourly price refresh for the assets backing investment methods.
 *
 * Hourly, not per-minute: CoinGecko's keyless tier allows ~10k calls/month and
 * one hourly call is ~720. Per-minute would be ~43k and break it. It is also
 * what Vercel's cron scheduling supports on a paid plan; Hobby only runs
 * crons daily, so on Hobby this endpoint simply fires once a day.
 */

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  throw new Error("CRON_SECRET is not configured");
}
const EXPECTED_AUTH_HEADER = `Bearer ${CRON_SECRET}`;

function isAuthorized(authHeader: string | null): boolean {
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (!authHeader || authHeader.length !== EXPECTED_AUTH_HEADER.length) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(EXPECTED_AUTH_HEADER)
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshPrices();

  // Partial failures are reported, not thrown: one unpriced asset must not
  // discard the quotes that did land.
  return NextResponse.json({
    ok: true,
    ...result,
    at: new Date().toISOString(),
  });
}
