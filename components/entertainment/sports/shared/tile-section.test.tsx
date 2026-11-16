// @vitest-environment jsdom
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { showNames, TILE, TILE_FRAME, TileSection, useRevealEarlier } from "./tile-section";

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

  it("keeps the hover for the tiles that are links, off the frame a still tile uses", () => {
    expect(TILE.startsWith(TILE_FRAME)).toBe(true);
    expect(TILE).toContain("hover:border-foreground/25");
    expect(TILE_FRAME).not.toContain("hover:");
    expect(TILE_FRAME.split(" ")).toContain("focus-visible:ring-ring");
  });
});

describe("showNames", () => {
  it("names what a tap brings in by its first and last, or its one", () => {
    expect(showNames([{ name: "Shanghai" }, { name: "Vienna" }, { name: "Paris" }])).toBe("Show Shanghai – Paris");
    expect(showNames([{ name: "Fiji Pro" }])).toBe("Show Fiji Pro");
  });
});


describe("useRevealEarlier", () => {
  const played = ["e", "d", "c", "b", "a"].map((id) => ({ id }));
  const ids = (list: readonly { id: string }[]): string[] => list.map((item) => item.id);

  it("shows the latest event played from the start, the three before it a tap away", () => {
    const { result } = renderHook(() => useRevealEarlier(played, { open: false, attr: "data-tournament" }));
    expect(ids(result.current.earlier)).toEqual(["e"]);
    expect(ids(result.current.next)).toEqual(["d", "c", "b"]);
  });

  it("shows the last three once nothing is left to come", () => {
    const { result } = renderHook(() => useRevealEarlier(played, { open: true, attr: "data-tournament" }));
    expect(ids(result.current.earlier)).toEqual(["e", "d", "c"]);
    expect(ids(result.current.next)).toEqual(["b", "a"]);
  });
});
