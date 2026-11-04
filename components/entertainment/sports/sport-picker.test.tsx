// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SPORTS } from "@/lib/data/sports/registry";

import { SportPicker } from "./sport-picker";

describe("SportPicker", () => {
  it("marks the sport on screen with a bar as well as a shade, and only that one", () => {
    render(<SportPicker active="nba" sports={SPORTS} favorites={new Set()} onPick={vi.fn()} />);
    const current = screen.getByRole("link", { name: "NBA" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("relative", "bg-muted", "after:absolute", "after:border-b-2", "after:border-primary");
    // The outline variant's dark fill would otherwise hide the shade in dark mode.
    expect(current).toHaveClass("dark:bg-muted");
    expect(current).not.toHaveClass("dark:bg-input/30");

    const other = screen.getByRole("link", { name: "Padel" });
    expect(other).not.toHaveAttribute("aria-current");
    expect(other).not.toHaveClass("after:border-primary");
    expect(other).toHaveClass("text-muted-foreground");
  });
});
