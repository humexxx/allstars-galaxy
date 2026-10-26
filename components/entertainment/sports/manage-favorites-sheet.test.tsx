// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportFavoriteAction: vi.fn() }));

import { setSportFavoriteAction } from "@/app/actions/sports";

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

  it("counts the list the server sends next, a change made elsewhere included", () => {
    const { rerender } = render(
      <ManageFavoritesSheet favoriteSportIds={["nba", "f1", "lol", "padel", "football"]} trigger="icon" />
    );
    expect(screen.getByRole("button", { name: "Manage favorites (5)" })).toBeInTheDocument();
    // The assistant took football off; the page came back with four.
    rerender(<ManageFavoritesSheet favoriteSportIds={["nba", "f1", "lol", "padel"]} trigger="icon" />);
    expect(screen.getByRole("button", { name: "Manage favorites (4)" })).toBeInTheDocument();
  });

  it("flips a sport at once, and back when the change fails", async () => {
    let settle: (value: { success: false; error: string }) => void = () => {};
    vi.mocked(setSportFavoriteAction).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }) as never
    );
    render(<ManageFavoritesSheet favoriteSportIds={["nba"]} trigger="icon" />);
    fireEvent.click(screen.getByRole("button", { name: "Manage favorites (1)" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /Toggle (F1|Formula 1) as favorite/ }));
    });
    expect(screen.getByRole("button", { name: "Manage favorites (2)", hidden: true })).toBeInTheDocument();

    await act(async () => {
      settle({ success: false, error: "Failed to update favorites" });
    });
    expect(screen.getByRole("button", { name: "Manage favorites (1)", hidden: true })).toBeInTheDocument();
  });
});
