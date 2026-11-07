/**
 * How a period's obligations (living expenses + scheduled debt payments) sit
 * against its income, as the plan page's gauge names it. A band takes every
 * percent under its `below` the bands before it left; 100% itself is
 * Strained, and Underwater is anything over: spending more than comes in.
 *
 * Read by the WHOLE percent the gauge prints, so a ratio of 0.496 that shows
 * "50%" is named like 50%, never a band the number on screen contradicts.
 */
export type PeriodHealthBand = {
  label: "Thriving" | "Healthy" | "Steady" | "Tight" | "Strained" | "Underwater";
  /** A `--health-*` token from globals.css. */
  color: string;
};

const BANDS: readonly (PeriodHealthBand & { below: number })[] = [
  { below: 50, label: "Thriving", color: "var(--health-thriving)" },
  { below: 70, label: "Healthy", color: "var(--health-healthy)" },
  { below: 80, label: "Steady", color: "var(--health-steady)" },
  { below: 90, label: "Tight", color: "var(--health-tight)" },
  { below: 101, label: "Strained", color: "var(--health-strained)" },
  { below: Infinity, label: "Underwater", color: "var(--health-underwater)" },
];

export function periodHealthBand(ratio: number): PeriodHealthBand {
  const percent = Math.round(Math.max(0, ratio) * 100);
  const { label, color } = BANDS.find((b) => percent < b.below)!;
  return { label, color };
}
