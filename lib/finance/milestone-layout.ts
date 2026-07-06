/**
 * Collision-aware layout for the projection chart's milestone labels.
 *
 * The chart marks each milestone crossing with a vertical reference line plus
 * a small text label above the plot. Labels have a fixed pixel width, so on
 * narrow screens (or when several milestones cross close together) they used
 * to overlap. This pure helper decides, per crossing, whether its label
 * renders on the base row (0), gets staggered onto a second row (1), or is
 * dropped entirely — the reference line itself always renders, so a dropped
 * label never hides the crossing.
 */

export type MilestoneCrossing = {
  /** X position in x-axis units (fractional month index). */
  x: number;
  milestone: number;
};

export type MilestonePlacement = MilestoneCrossing & {
  /** 0 = base row (just above the plot), 1 = staggered row above it. */
  row: 0 | 1;
};

export type MilestoneLayoutOptions = {
  /** Plot-area pixels per x-axis unit. */
  pxPerUnit: number;
  /** Rendered label width in px — labels closer than this (plus padding) collide. */
  labelWidthPx: number;
  /** X (in axis units) of "today" — proximity tie-break for equal milestones. */
  todayX: number;
  /** Optional cap on how many labels render (narrow screens). */
  maxLabels?: number;
};

/**
 * Greedy placement by priority: larger milestones win, ties go to the crossing
 * nearest today. Each candidate tries row 0, then row 1, and is dropped when
 * both rows already have a label within one label-width of it.
 */
export function layoutMilestoneLabels(
  crossings: readonly MilestoneCrossing[],
  options: MilestoneLayoutOptions
): MilestonePlacement[] {
  const { pxPerUnit, labelWidthPx, todayX, maxLabels } = options;
  const minGapPx = labelWidthPx + 4;

  const candidates = [...crossings].sort((a, b) => {
    if (a.milestone !== b.milestone) return b.milestone - a.milestone;
    return Math.abs(a.x - todayX) - Math.abs(b.x - todayX);
  });

  const placed: MilestonePlacement[] = [];
  const rows: [number[], number[]] = [[], []];

  for (const c of candidates) {
    if (maxLabels !== undefined && placed.length >= maxLabels) break;
    const px = c.x * pxPerUnit;
    const fits = (row: 0 | 1) => rows[row].every((p) => Math.abs(p - px) >= minGapPx);
    const row = fits(0) ? 0 : fits(1) ? 1 : null;
    if (row === null) continue;
    rows[row].push(px);
    placed.push({ ...c, row });
  }

  return placed;
}
