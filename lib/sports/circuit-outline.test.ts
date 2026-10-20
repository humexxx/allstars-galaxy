import { describe, expect, it } from "vitest";

import { F1_DATA } from "@/lib/data/sports/f1";
import { F1_CIRCUIT_OUTLINES, F1_CIRCUIT_VIEWBOX } from "@/lib/data/sports/f1-circuits";

import {
  CIRCUIT_PADDING,
  CIRCUIT_VIEWBOX_SIZE,
  outlinePath,
  projectCircuit,
  type LonLat,
  type Point,
} from "./circuit-outline";

/** The absolute points of a path `outlinePath` wrote. */
function readOutline(d: string): Point[] {
  const match = /^M(\d+) (\d+)l([-\d ]*)z$/.exec(d);
  if (!match) throw new Error(`Not one closed outline: ${d.slice(0, 40)}…`);
  const steps = (match[3].match(/-?\d+/g) ?? []).map(Number);
  const points: Point[] = [[Number(match[1]), Number(match[2])]];
  for (let i = 0; i < steps.length; i += 2) {
    const [x, y] = points[points.length - 1];
    points.push([x + steps[i], y + steps[i + 1]]);
  }
  return points;
}

const bounds = (points: readonly Point[]) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

/** A rectangle of lon/lat, closed the way GeoJSON closes a ring. */
const rectangle = (lon: number, lat: number, dLon: number, dLat: number): LonLat[] => [
  [lon, lat],
  [lon + dLon, lat],
  [lon + dLon, lat + dLat],
  [lon, lat + dLat],
  [lon, lat],
];

describe("projectCircuit", () => {
  it("fits the long side to the box and centres the short one", () => {
    // On the equator a degree is the same length either way: twice as wide
    // as tall stays twice as wide as tall.
    const box = bounds(projectCircuit(rectangle(0, -0.005, 0.02, 0.01)));
    expect(box.minX).toBeCloseTo(CIRCUIT_PADDING);
    expect(box.maxX).toBeCloseTo(CIRCUIT_VIEWBOX_SIZE - CIRCUIT_PADDING);
    expect(box.maxY - box.minY).toBeCloseTo((CIRCUIT_VIEWBOX_SIZE - 2 * CIRCUIT_PADDING) / 2);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(CIRCUIT_VIEWBOX_SIZE / 2);
  });

  it("shrinks longitude by the cosine of the latitude", () => {
    // At 60°N a degree of longitude is half a degree of latitude long, so a
    // square of degrees is a rectangle twice as tall as it is wide.
    const box = bounds(projectCircuit(rectangle(10, 59.99, 0.02, 0.02)));
    expect((box.maxX - box.minX) / (box.maxY - box.minY)).toBeCloseTo(0.5);
  });

  it("puts north at the top", () => {
    const [south, , north] = projectCircuit([
      [0, 0],
      [0.01, 0.005],
      [0, 0.01],
    ]);
    expect(north[1]).toBeLessThan(south[1]);
  });

  it("refuses a line with nothing to draw", () => {
    expect(() => projectCircuit([[1, 1], [2, 2]])).toThrow();
    expect(() => projectCircuit([[1, 1], [1, 1], [1, 1]])).toThrow();
  });
});

describe("outlinePath", () => {
  it("writes one closed path of relative steps, without the ring's repeated first point", () => {
    expect(
      outlinePath([
        [100, 100],
        [300, 100],
        [300, 250],
        [100, 100],
      ])
    ).toBe("M100 100l200 0 0 150z");
  });

  it("rounds onto whole units and drops a point that lands on the one before", () => {
    // A minus sign separates two numbers on its own: "0-1", not "0 -1".
    expect(
      outlinePath([
        [100.4, 100.4],
        [99.6, 100.2],
        [300.6, 100],
        [300, 250],
      ])
    ).toBe("M100 100l201 0-1 150z");
  });

  it("takes each step between rounded points, so the lap does not drift", () => {
    const ring = rectangle(144.9, -37.85, 0.013, 0.007);
    const projected = projectCircuit(ring);
    const expected = projected.slice(0, -1).map(([x, y]) => [Math.round(x), Math.round(y)]);
    expect(readOutline(outlinePath(projected))).toEqual(expected);
  });
});

describe("the vendored outlines", () => {
  // Jolpica's 2026 calendar as it stood on 2026-10-18.
  const CALENDAR_2026 = [
    "albert_park", "shanghai", "suzuka", "miami", "villeneuve", "monaco",
    "catalunya", "red_bull_ring", "silverstone", "spa", "hungaroring",
    "zandvoort", "monza", "madring", "baku", "sepang", "marina_bay",
    "americas", "rodriguez", "interlagos", "vegas", "losail", "yas_marina",
  ];

  it("cover every circuit on the calendar", () => {
    expect(CALENDAR_2026.filter((id) => !F1_CIRCUIT_OUTLINES[id])).toEqual([]);
  });

  it("cover every race in the fixture served when Jolpica has never answered", () => {
    expect(F1_DATA.races.filter((r) => !F1_CIRCUIT_OUTLINES[r.circuitId])).toEqual([]);
  });

  it("are each one closed line inside the box the view draws", () => {
    expect(F1_CIRCUIT_VIEWBOX).toBe(`0 0 ${CIRCUIT_VIEWBOX_SIZE} ${CIRCUIT_VIEWBOX_SIZE}`);
    for (const d of Object.values(F1_CIRCUIT_OUTLINES)) {
      const points = readOutline(d);
      expect(points.length).toBeGreaterThan(50);
      const box = bounds(points);
      expect(box.minX).toBeGreaterThanOrEqual(0);
      expect(box.minY).toBeGreaterThanOrEqual(0);
      expect(box.maxX).toBeLessThanOrEqual(CIRCUIT_VIEWBOX_SIZE);
      expect(box.maxY).toBeLessThanOrEqual(CIRCUIT_VIEWBOX_SIZE);
      // Fitted, not floating: the long side spans the box inside its margin.
      expect(Math.max(box.maxX - box.minX, box.maxY - box.minY)).toBeGreaterThanOrEqual(
        CIRCUIT_VIEWBOX_SIZE - 2 * CIRCUIT_PADDING - 1
      );
    }
  });
});
