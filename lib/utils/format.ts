const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Half a cent. Money that rounds to zero at 2 decimals IS zero: it prints
 * without a minus sign and is never classed as a deficit. Floating-point
 * leftovers like `0.3 - (0.1 + 0.2)` (≈ −5.5e−17) used to render as "−$0.00"
 * and turn a balanced budget red.
 */
export const CENTS_EPSILON = 0.005;

/** Rounds to cents, folding −0 into 0. */
export function roundCents(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/** −1, 0 or 1 at cent precision: anything within half a cent of 0 is 0. */
export function moneySign(value: number): -1 | 0 | 1 {
  if (value <= -CENTS_EPSILON) return -1;
  if (value >= CENTS_EPSILON) return 1;
  return 0;
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0.00";
  return CURRENCY_FORMATTER.format(roundCents(num));
}

/** "$350k", "$1.5M", "-$2k" — axis ticks and chips, never a balance. */
export function formatCurrencyCompact(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0";
  const abs = Math.abs(num);
  const trim = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));
  // Pick the unit AFTER rounding: 999,960 rounds to 1000.0k, which must read
  // "$1M", and 999.6 rounds to 1000, which must read "$1k".
  let body: string;
  const whole = Math.round(abs);
  if (whole < 1_000) {
    body = String(whole);
  } else {
    const k = Math.round(abs / 100) / 10;
    body = k < 1_000 ? `${trim(k)}k` : `${trim(Math.round(abs / 100_000) / 10)}M`;
  }
  // A value that rounds to zero prints without a sign ("$0", never "-$0").
  const sign = num < 0 && body !== "0" ? "-" : "";
  return `${sign}$${body}`;
}

export function formatSignedCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0.00";
  // Round first: -0.004 formats as "0.00", and a minus in front of nothing
  // is a sign with no magnitude.
  const rounded = Math.round(num * 100) / 100;
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${CURRENCY_FORMATTER.format(Math.abs(rounded))}`;
}

export function formatPercent(value: number | null | undefined, fractionDigits: number = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00%";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, fractionDigits: number = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00%";
  const text = value.toFixed(fractionDigits);
  const sign = Number(text) >= 0 ? "+" : "";
  return `${sign}${text.startsWith("-") && Number(text) === 0 ? text.slice(1) : text}%`;
}

export function toFixed2(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
}

export function parseDecimal(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
}
