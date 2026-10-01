/** A plain decimal: what the app itself writes into every amount column. */
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * RFC 4180 quoting. The leading-symbol guard is the important part: a cell
 * starting with = + - or @ is executed as a formula by Excel and Sheets, so a
 * crafted note could run on whoever opens the file. Prefixing a single quote
 * neutralises it without changing the visible text.
 *
 * A plain number is exempt. "-500.00" is not a formula, and quoting it turned
 * every withdrawal and every loss into TEXT ("'-500.00") that a spreadsheet
 * cannot sum — the one column a reader totals by hand.
 */
export function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (!NUMBER.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Withdrawals carry a minus sign so the totals line nets them. */
export function signed(value: string | null, type: string): string | null {
  if (value === null) return null;
  return type === "withdrawal" && parseFloat(value) !== 0 ? `-${value}` : value;
}
