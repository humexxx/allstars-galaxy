// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SportSkeleton, sportShape } from "./sports-navigation";

describe("sportShape", () => {
  const november = new Date("2026-11-22T12:00:00Z");
  const july = new Date("2026-07-01T12:00:00Z");

  it("draws each sport as its page opens", () => {
    expect(sportShape("f1", null, november)).toBe("f1");
    expect(sportShape("padel", null, november)).toBe("racquet");
    expect(sportShape("tennis", null, november)).toBe("racquet");
    expect(sportShape("surf", null, november)).toBe("surf");
    expect(sportShape("nba", null, november)).toBe("matches");
    expect(sportShape(undefined, null, november)).toBe("matches");
  });

  it("draws a bracket for the sports that open on one at this time of year", () => {
    expect(sportShape("mlb", null, november)).toBe("bracket");
    expect(sportShape("mlb", null, july)).toBe("matches");
    expect(sportShape("lol", null, november)).toBe("bracket");
    expect(sportShape("lol", null, july)).toBe("matches");
  });

  it("draws the News tab when the address opens on it", () => {
    expect(sportShape("padel", "news", november)).toBe("news");
  });
});

describe("SportSkeleton", () => {
  it("gives padel its poster and F1 its standings switch, and hides the picture from a screen reader", () => {
    const padel = render(<SportSkeleton sport="padel" />);
    expect(padel.container.querySelector(".aspect-video")).not.toBeNull();
    expect(padel.container.querySelector(".h-14")).toBeNull();
    padel.unmount();

    const f1 = render(<SportSkeleton sport="f1" />);
    expect(f1.container.querySelector(".h-14")).not.toBeNull();
    expect(f1.container.querySelector('[aria-hidden="true"] .h-14')).not.toBeNull();
  });
});
