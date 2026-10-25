// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportFavoriteAction: vi.fn() }));

import { ManageFavoritesSheet } from "./manage-favorites-sheet";

describe("ManageFavoritesSheet", () => {
  it("prints the star's count dark on light, not white on the brand blue (3.7:1)", () => {
    render(<ManageFavoritesSheet favoriteSportIds={["nba", "f1"]} trigger="icon" />);
    const count = within(screen.getByRole("button", { name: "Manage favorites (2)" })).getByText("2");
    expect(count).toHaveClass("bg-foreground", "text-background");
    expect(count).not.toHaveClass("bg-primary");
    expect(count).not.toHaveClass("text-primary-foreground");
  });

  it("keeps the blue on the button's count tint and the number in the text colour", () => {
    render(<ManageFavoritesSheet favoriteSportIds={["nba"]} />);
    const count = within(screen.getByRole("button", { name: /Manage favorites/ })).getByText("1");
    expect(count).toHaveClass("bg-primary/10", "text-foreground");
    expect(count).not.toHaveClass("text-primary");
  });
});
