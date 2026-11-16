import { describe, expect, it } from "vitest";

import { MASCOT_CHARACTER_LABELS, MASCOT_CHARACTERS } from "@/types/preferences";

import { LOOKS, type HeroFace, type Look } from "./looks";
import { add, box, circle, on, PX, rasterise, type Layer } from "./sprite";

const FACES: HeroFace[] = ["calm", "happy", "tired"];

function layersOf(look: Look): Layer[] {
  return [
    ...FACES.flatMap((face) => look.head(face)),
    ...(look.torso ?? []),
    ...(look.back ?? []),
    ...(look.arm ?? []),
    ...(look.leg ?? []),
  ];
}

describe("mascot looks", () => {
  it("has a look and a label for every character", () => {
    for (const id of MASCOT_CHARACTERS) {
      expect(LOOKS[id]).toBeDefined();
      expect(MASCOT_CHARACTER_LABELS[id]).toBeTruthy();
    }
  });

  it.each(MASCOT_CHARACTERS)("%s paints only colours its palette holds", (id) => {
    const look = LOOKS[id];
    const roles = new Set([...Object.keys(look.palette), "ink"]);
    for (const { color } of layersOf(look)) expect(roles).toContain(color);
    for (const role of ["top", "pants", "shoe", look.hand ?? "skin"]) expect(roles).toContain(role);
  });

  it.each(MASCOT_CHARACTERS)("%s draws a head for every face", (id) => {
    for (const face of FACES) {
      const paths = rasterise(LOOKS[id].head(face), [-34, -82, 30, -28]);
      expect(paths.some((p) => p.color === "ink")).toBe(true);
      expect(paths.length).toBeGreaterThan(2);
    }
  });
});

describe("rasterise", () => {
  it("rings a figure in ink one square wide", () => {
    const paths = rasterise([add("a", box(0, 0, PX, PX))], [0, 0, PX, PX]);
    expect(paths.find((p) => p.color === "a")?.d).toBe(`M0 0h${PX}v${PX}h${-PX}z`);
    expect(paths.find((p) => p.color === "ink")?.d.split("M")).toHaveLength(5);
  });

  it("merges a run of squares into one rectangle", () => {
    const [body] = rasterise([add("a", box(0, 0, PX * 4, PX))], [0, 0, PX * 4, PX]).filter((p) => p.color === "a");
    expect(body.d).toBe(`M0 0h${PX * 4}v${PX}h${-PX * 4}z`);
  });

  it("paints `on` only where the figure already is", () => {
    const paths = rasterise([add("a", circle(0, 0, 3)), on("b", box(-30, -30, 30, 30)), on("c", box(20, 20, 30, 30))], [-6, -6, 6, 6]);
    expect(paths.map((p) => p.color).sort()).toEqual(["b", "ink"]);
  });
});
