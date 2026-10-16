import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Bearer check for the cron routes.
 *
 * Reads `CRON_SECRET` at request time, not module load: a module-scope throw
 * made every `next build` without the secret fail while collecting page data,
 * and an unset secret should refuse requests, not builds. Fails closed.
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!authHeader) return false;
  const given = Buffer.from(authHeader);
  const expected = Buffer.from(`Bearer ${secret}`);
  // Compare BYTE lengths: timingSafeEqual throws on a mismatch, and a
  // non-ASCII header can have the right character count but more bytes —
  // that threw a 500 instead of answering 401.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
