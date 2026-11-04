/**
 * The dashboard finance card's load-in, shared by the chart (client) and the
 * figure rail (server-rendered, counting up on the client): every series
 * sweeps in and every figure counts up on the same clock, small parts first
 * and net worth last, all on easeOutQuint — the curve the health donut's
 * count-up already uses.
 */
export const SWEEP_MS = 1100;
export const STAGGER_MS = 260;

/** When each part starts: cash, portfolio, debt, owed to you, net worth. */
export const DRAW_ORDER = {
  savings: 0,
  investments: 1,
  debt: 2,
  receivables: 3,
  netWorth: 4,
} as const;

export function drawDelay(key: keyof typeof DRAW_ORDER): number {
  return DRAW_ORDER[key] * STAGGER_MS;
}

/** easeOutQuint: fast off the mark, settling gently. */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/** Time (0..1) at which `easeOut` reaches `progress` (0..1). */
function easeOutInverse(progress: number): number {
  return 1 - Math.pow(1 - progress, 1 / 5);
}

/**
 * One eased stroke split in two consecutive animations — the net-worth line
 * is a solid past and a dashed projection, each animating along its own
 * length. `share` is the past's part of the whole stroke. Each half gets the
 * slice of time and the slice of the curve it covers, so the speed carries
 * straight through "Now" instead of stopping and restarting there.
 */
export function splitEasedStroke(
  share: number,
  durationMs: number
): {
  first: { duration: number; easing: (t: number) => number };
  second: { delay: number; duration: number; easing: (t: number) => number };
} {
  const s = Math.min(1, Math.max(0, share));
  const split = easeOutInverse(s);
  const firstDuration = Math.max(1, Math.round(durationMs * split));
  return {
    first: {
      duration: firstDuration,
      easing: (t) => (s === 0 ? 1 : easeOut(t * split) / s),
    },
    second: {
      delay: firstDuration,
      duration: Math.max(1, Math.round(durationMs * (1 - split))),
      easing: (t) => (s === 1 ? 1 : (easeOut(split + t * (1 - split)) - s) / (1 - s)),
    },
  };
}
