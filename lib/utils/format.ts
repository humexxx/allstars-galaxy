const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0.00";
  return CURRENCY_FORMATTER.format(num);
}

export function formatSignedCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "$0.00";
  const sign = num >= 0 ? "+" : "-";
  return `${sign}${CURRENCY_FORMATTER.format(Math.abs(num))}`;
}

export function formatPercent(value: number | null | undefined, fractionDigits: number = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00%";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, fractionDigits: number = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0.00%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
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
