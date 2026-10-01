/**
 * Money typed into a form: what the confirmation dialog accepts and how it
 * explains a refusal. The schema (`schemas/finance-confirmations.ts`) takes
 * plain decimals only, and a refusal used to come back as a bare "Invalid
 * input" toast that named no field; these keep the client in step with it.
 */

/** "$1,234.50" → "1234.50": what people paste from a banking app. */
export function normalizeAmount(raw: string): string {
  return raw.replace(/[\s,$]/g, "");
}

const SIGNED = /^-?\d+(\.\d{1,2})?$/;
const UNSIGNED = /^\d+(\.\d{1,2})?$/;

/** The message for one field, or null when it is valid. */
export function amountError(raw: string, allowNegative: boolean): string | null {
  const value = normalizeAmount(raw);
  if (value === "") return "Enter an amount (0 if none).";
  if ((allowNegative ? SIGNED : UNSIGNED).test(value)) return null;
  if (!allowNegative && /^-/.test(value)) return "Can't be negative.";
  return "Use a number with up to 2 decimals, like 1250.50.";
}
