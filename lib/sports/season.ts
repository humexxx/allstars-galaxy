/** A season that spans two years, as hockey's does: 2026 → "2026–27". */
export function splitSeasonLabel(season: number): string {
  return `${season}–${String((season + 1) % 100).padStart(2, "0")}`;
}
