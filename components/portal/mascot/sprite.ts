/**
 * Turns a figure described in shapes into the squares of a sprite. A character
 * is authored the way the scenery is — circles, boxes, polygons, in the hero's
 * own units — and sampled onto a grid here, so how blocky the cast looks is the
 * one number below and never a redraw.
 */

/** The side of one sprite square, in the hero's units. */
export const PX = 1.5;

export type Shape = (x: number, y: number) => boolean;

export const circle =
  (cx: number, cy: number, r: number): Shape =>
  (x, y) =>
    (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

export const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** A box from (x0, y0) to (x1, y1), its corners rounded by `r`. */
export function box(x0: number, y0: number, x1: number, y1: number, r = 0): Shape {
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.max(x0 + r - x, x - (x1 - r), 0);
    const dy = Math.max(y0 + r - y, y - (y1 - r), 0);
    return dx * dx + dy * dy <= r * r;
  };
}

/** A polygon through the points given flat: x0, y0, x1, y1, … */
export function poly(...flat: number[]): Shape {
  const pts: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

export const all =
  (...shapes: Shape[]): Shape =>
  (x, y) =>
    shapes.every((s) => s(x, y));

export const any =
  (...shapes: Shape[]): Shape =>
  (x, y) =>
    shapes.some((s) => s(x, y));

export const not =
  (shape: Shape): Shape =>
  (x, y) =>
    !shape(x, y);

export type Layer = { color: string; shape: Shape; over: boolean };

/** Paints `shape`, growing the figure where it reaches past it. */
export const add = (color: string, shape: Shape): Layer => ({ color, shape, over: false });

/** Paints `shape` only where the figure already is: a shade, an eye, a stripe. */
export const on = (color: string, shape: Shape): Layer => ({ color, shape, over: true });

export type Bounds = [x0: number, y0: number, x1: number, y1: number];

export type SpritePath = { color: string; d: string };

const num = (v: number): number => Number(v.toFixed(2));

/**
 * Samples `layers`, painted in order, at the middle of every square inside
 * `bounds`, then rings the figure in ink one square wide. One path per colour:
 * a run of squares in a row is one rectangle.
 */
export function rasterise(layers: readonly Layer[], [x0, y0, x1, y1]: Bounds): SpritePath[] {
  const c0 = Math.floor(x0 / PX) - 1;
  const r0 = Math.floor(y0 / PX) - 1;
  const cols = Math.ceil(x1 / PX) + 1 - c0;
  const rows = Math.ceil(y1 / PX) + 1 - r0;
  const cells: (string | undefined)[] = new Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c0 + c + 0.5) * PX;
      const y = (r0 + r + 0.5) * PX;
      let color: string | undefined;
      for (const layer of layers) {
        if ((!layer.over || color !== undefined) && layer.shape(x, y)) color = layer.color;
      }
      cells[r * cols + c] = color;
    }
  }

  const filled = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols && cells[r * cols + c] !== undefined;
  const ring: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (filled(r, c)) continue;
      if (filled(r - 1, c) || filled(r + 1, c) || filled(r, c - 1) || filled(r, c + 1)) ring.push(r * cols + c);
    }
  }
  for (const i of ring) cells[i] = "ink";

  const runs = new Map<string, string[]>();
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const color = cells[r * cols + c];
      if (color === undefined) {
        c++;
        continue;
      }
      let end = c + 1;
      while (end < cols && cells[r * cols + end] === color) end++;
      const w = num((end - c) * PX);
      const d = `M${num((c0 + c) * PX)} ${num((r0 + r) * PX)}h${w}v${PX}h${-w}z`;
      const list = runs.get(color);
      if (list) list.push(d);
      else runs.set(color, [d]);
      c = end;
    }
  }
  return [...runs].map(([color, list]) => ({ color, d: list.join("") }));
}
