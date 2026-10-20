/**
 * Track outlines for the F1 race cards: a circuit's GeoJSON line projected
 * onto a fixed square and written as one SVG path.
 *
 * `scripts/build-f1-circuits.ts` runs these once to generate
 * `lib/data/sports/f1-circuits.ts`; the app only reads the generated paths.
 */

/** The square every outline is fitted to, in SVG user units. */
export const CIRCUIT_VIEWBOX_SIZE = 1000;

/**
 * Room for the stroke, which straddles the path and would be clipped at the
 * box's edge: a 2px line drawn 25px across still clears it.
 */
export const CIRCUIT_PADDING = 40;

export type LonLat = readonly [lon: number, lat: number];
export type Point = readonly [x: number, y: number];

/**
 * North up, one scale for both axes, centred in the box.
 *
 * A degree of longitude shrinks with the cosine of the latitude, so plotting
 * raw lon/lat would stretch every track east–west — Silverstone, at 52°N, by
 * 1.6×. One factor for the whole track, at its middle latitude, is exact to
 * far under a pixel over a few kilometres.
 */
export function projectCircuit(
  line: readonly LonLat[],
  size: number = CIRCUIT_VIEWBOX_SIZE,
  padding: number = CIRCUIT_PADDING
): Point[] {
  if (line.length < 3) throw new Error("A circuit outline needs at least three points");

  const lats = line.map(([, lat]) => lat);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  // Latitude grows north and SVG's y grows down the screen.
  const flat = line.map(([lon, lat]) => [lon * k, -lat] as const);

  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const extent = Math.max(width, height);
  if (!(extent > 0)) throw new Error("A circuit outline needs more than one distinct point");

  const scale = (size - 2 * padding) / extent;
  const offsetX = (size - width * scale) / 2;
  const offsetY = (size - height * scale) / 2;
  return flat.map(([x, y]) => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale]);
}

/**
 * One closed path through the points, on whole units.
 *
 * Every step after the first is relative (`l`), which keeps the numbers to a
 * digit or two. The steps are taken between the rounded points, not rounded
 * themselves, so the error never accumulates along the lap.
 */
export function outlinePath(points: readonly Point[]): string {
  const grid: Array<readonly [number, number]> = [];
  for (const [x, y] of points) {
    const p = [Math.round(x), Math.round(y)] as const;
    const last = grid.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) grid.push(p);
  }
  // A GeoJSON ring repeats its first point to close; `z` closes the path.
  const first = grid[0];
  const last = grid.at(-1);
  if (first && last && grid.length > 1 && first[0] === last[0] && first[1] === last[1]) grid.pop();
  if (grid.length < 3) throw new Error("A circuit outline needs at least three distinct points");

  let steps = "";
  for (let i = 1; i < grid.length; i++) {
    for (const n of [grid[i][0] - grid[i - 1][0], grid[i][1] - grid[i - 1][1]]) {
      // A minus sign separates two numbers on its own.
      steps += steps === "" || n < 0 ? `${n}` : ` ${n}`;
    }
  }
  return `M${grid[0][0]} ${grid[0][1]}l${steps}z`;
}
