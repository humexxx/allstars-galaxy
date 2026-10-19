/**
 * Recharts picks a numeric axis's ticks while it renders, but a left `YAxis`
 * needs its `width` before that. A guessed width either wastes plot room or
 * clips the widest label: at 40px "-$100k" lost its minus sign. `niceTicks`
 * computes the ticks recharts would draw, so a chart can pass them in and size
 * the axis to the labels it is actually going to show.
 */

const TICK_COUNT = 5;
/** Recharts reserves the tick line's length even with `tickLine={false}`. */
const TICK_SIZE = 6;
/** An upper bound for one tick-label glyph at the charts' 12px. */
const GLYPH_PX = 8;

/** Absorbs float noise (35000.000000000004) so ticks stay round. */
const clean = (n: number): number => Number(n.toPrecision(12));
/** `Math.ceil` / `Math.floor` that a float a hair off an integer can't bump. */
const ceil = (n: number): number => Math.ceil(n - 1e-9);
const floor = (n: number): number => Math.floor(n + 1e-9);

function digitCount(n: number): number {
  return n === 0 ? 1 : Math.floor(Math.log10(Math.abs(n))) + 1;
}

function formatStep(roughStep: number, correction: number): number {
  const digits = digitCount(roughStep);
  const unit = clean((digits !== 1 ? 0.05 : 0.1) * 10 ** digits);
  return clean((ceil(roughStep / unit) + correction) * unit);
}

function singleValueTicks(value: number, tickCount: number): number[] {
  let step = 1;
  let middle = value;
  if (!Number.isInteger(value)) {
    if (Math.abs(value) < 1) {
      step = 10 ** (digitCount(value) - 1);
      middle = floor(value / step) * step;
    } else {
      middle = Math.floor(value);
    }
  } else if (value === 0) {
    middle = Math.floor((tickCount - 1) / 2);
  }
  const middleIndex = Math.floor((tickCount - 1) / 2);
  return Array.from({ length: tickCount }, (_, i) => clean(middle + (i - middleIndex) * step));
}

function rangeTicks(min: number, max: number, tickCount: number, correction = 0): number[] {
  const step = formatStep((max - min) / (tickCount - 1), correction);
  let middle = 0;
  if (min > 0 || max < 0) {
    const mid = (min + max) / 2;
    middle = clean(mid - (mid % step));
  }
  let below = ceil((middle - min) / step);
  let up = ceil((max - middle) / step);
  const count = below + up + 1;
  if (count > tickCount) return rangeTicks(min, max, tickCount, correction + 1);
  if (count < tickCount) {
    if (max > 0) up += tickCount - count;
    else below += tickCount - count;
  }
  return Array.from({ length: below + up + 1 }, (_, i) => clean(middle + (i - below) * step));
}

/**
 * The ticks recharts draws for these values on an axis left at its defaults
 * (`domain={[0, "auto"]}`, `tickCount={5}`): recharts-scale's
 * `getNiceTickValues`, in plain floats instead of decimal.js. Pass them back
 * as `ticks`, with their ends as the `domain`, so the axis draws exactly them.
 */
export function niceTicks(values: readonly number[]): number[] {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite);
  const max = finite.length > 0 ? Math.max(...finite) : 0;
  return min === max ? singleValueTicks(min, TICK_COUNT) : rangeTicks(min, max, TICK_COUNT);
}

/**
 * The `width` for a left `YAxis` whose widest label must fit. That label ends
 * at `marginLeft + width - TICK_SIZE - tickMargin`, so the gap is paid for on
 * top of the text: pass the chart's own `tickMargin` and left margin.
 */
export function yAxisWidth(
  labels: readonly string[],
  { tickMargin = 2, marginLeft = 0 }: { tickMargin?: number; marginLeft?: number } = {}
): number {
  const widest = Math.max(0, ...labels.map((label) => label.length));
  return Math.max(0, widest * GLYPH_PX + TICK_SIZE + tickMargin - marginLeft);
}
