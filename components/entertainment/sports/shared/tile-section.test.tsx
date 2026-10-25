// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TILE, TileSection } from "./tile-section";

describe("TileSection", () => {
  it("heads its section at level 2, the level under the sport's h1", () => {
    render(
      <TileSection title="Coming up">
        <div>Tile</div>
      </TileSection>
    );
    expect(screen.getByRole("heading", { level: 2, name: "Coming up" })).toHaveClass("text-2xs", "py-1");
  });

  it("rings a focused tile in the full ring colour, the only cue it has", () => {
    const classes = TILE.split(" ");
    expect(classes).toContain("focus-visible:ring-ring");
    expect(classes.some((c) => c.startsWith("focus-visible:ring-ring/"))).toBe(false);
  });
});
