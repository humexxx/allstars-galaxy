/**
 * The milestone list a user gets before they customise anything, kept in its
 * own client-safe module: `user-preferences-service` is `server-only`, and the
 * chart (a client component) needs the same defaults for its fallback.
 *
 * Chosen to land on the values people actually aim at; the y-axis ticks cover
 * everything in between.
 */
export const DEFAULT_FINANCE_MILESTONES = [
  0, 10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000,
] as const;
