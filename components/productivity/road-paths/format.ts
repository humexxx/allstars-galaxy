const AMOUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * A road path figure as people read one: "7,250.5 / 18,000 USD", not the
 * bare "7250.5 / 18000" `parseFloat` hands back.
 */
export function formatAmount(value: number): string {
  return AMOUNT.format(value);
}

/** `numeric` column → number; null/blank/garbage → null. */
export function parseAmount(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
