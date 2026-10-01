const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const FRACTION = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

/**
 * Asset units at a precision that still says something.
 *
 * A fixed two decimals turned 0.01637 BTC into "0.02 BTC" — a 22% rounding on
 * the position the whole row is about. Whole units keep two decimals (shares,
 * bond-fund units); anything under one unit keeps four significant digits.
 */
export function formatUnits(quantity: number): string {
  return Math.abs(quantity) >= 1 ? WHOLE.format(quantity) : FRACTION.format(quantity);
}

const ROI = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * A method's promised monthly return, at the precision it is stored (four
 * decimals). Two fixed decimals showed 0.012% and 0.007% both as "0.01%" —
 * two different promises reading as the same product.
 */
export function formatRoi(percent: number): string {
  return `${ROI.format(percent)}%`;
}
