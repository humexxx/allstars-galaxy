/**
 * The dashboard finance card's load-in, shared by the chart (client) and the
 * figures (server-rendered, counting up on the client): every series sweeps
 * in and every figure counts up on one clock, small parts first and net worth
 * last.
 *
 * Tuned to the usual guidance for chart entrances: a line draw of about a
 * second at most, a short stagger between series (the whole card lands in
 * ~1.4s), deceleration rather than a constant speed, and no motion at all
 * under reduced motion. The sweep uses Material 3's standard curve — a soft
 * start, then a long settle — where easeOutQuint jolted off the mark and then
 * crawled; figures count up on easeOutQuart, the counter's customary curve.
 */
export const SWEEP_MS = 900;
export const STAGGER_MS = 120;
export const COUNT_MS = 900;

/** When each part starts: cash, portfolio, debt, owed to you, net worth. */
export const DRAW_ORDER = {
  trading: 0,
  investments: 1,
  debt: 2,
  receivables: 3,
  netWorth: 4,
} as const;

export function drawDelay(key: keyof typeof DRAW_ORDER): number {
  return DRAW_ORDER[key] * STAGGER_MS;
}

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as a function of time (0..1): solves the
 * curve's x for `t` (Newton, falling back to bisection), then reads its y.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  const at = (a: number, b: number, s: number): number =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number): number =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = at(x1, x2, s) - t;
      if (Math.abs(dx) < 1e-6) return at(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 30; i++) {
      if (at(x1, x2, s) < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return at(y1, y2, s);
  };
}

/** Material 3's standard easing: the chart's sweep. */
export const sweepEasing = cubicBezier(0.2, 0, 0, 1);

/** easeOutQuart: the count-up's curve. */
export function countEasing(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** The time (0..1) at which an increasing easing reaches `progress`. */
function inverse(easing: (t: number) => number, progress: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (easing(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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
  durationMs: number,
  easing: (t: number) => number = sweepEasing
): {
  first: { duration: number; easing: (t: number) => number };
  second: { delay: number; duration: number; easing: (t: number) => number };
} {
  const s = Math.min(1, Math.max(0, share));
  const split = s <= 0 ? 0 : s >= 1 ? 1 : inverse(easing, s);
  const firstDuration = Math.max(1, Math.round(durationMs * split));
  return {
    first: {
      duration: firstDuration,
      easing: (t) => (s === 0 ? 1 : easing(t * split) / s),
    },
    second: {
      delay: firstDuration,
      duration: Math.max(1, Math.round(durationMs * (1 - split))),
      easing: (t) => (s === 1 ? 1 : (easing(split + t * (1 - split)) - s) / (1 - s)),
    },
  };
}
