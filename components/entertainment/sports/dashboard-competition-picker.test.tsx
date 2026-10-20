// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportCompetitionAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

import { setSportCompetitionAction } from "@/app/actions/sports";
import type { ActionResult } from "@/lib/actions/safe";
import type { DashboardCompetitions } from "@/types/sports";

import { DashboardCompetitionPicker } from "./dashboard-competition-picker";

const TENNIS: DashboardCompetitions = {
  value: null,
  automatic: "Both tours",
  options: [
    { id: "atp", label: "ATP" },
    { id: "wta", label: "WTA" },
  ],
};

const FOOTBALL: DashboardCompetitions = {
  value: "uefa-champions-league",
  options: [
    { id: "uefa-champions-league", label: "UEFA Champions League" },
    { id: "la-liga", label: "LaLiga" },
  ],
};

function trigger(): HTMLElement {
  return screen.getByRole("combobox", { name: "Championship" });
}

/** Opens the menu from the keyboard, as a reader without a mouse would. */
function open(): void {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });
}

/** An action that answers only when the test says so. */
function deferred(): { resolve: (result: ActionResult) => void } {
  let resolve!: (result: ActionResult) => void;
  vi.mocked(setSportCompetitionAction).mockReturnValue(
    new Promise<ActionResult>((r) => {
      resolve = r;
    })
  );
  return { resolve };
}

beforeAll(() => {
  // jsdom has no layout: Radix Select scrolls its options into view and
  // releases pointer capture, neither of which exists there.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DashboardCompetitionPicker", () => {
  it("reads as the card's line, and offers the card's own pick first", () => {
    render(<DashboardCompetitionPicker sportId="tennis" label="Both tours" competitions={TENNIS} />);

    expect(trigger()).toHaveTextContent("Both tours");
    open();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Both tours", "ATP", "WTA"]);
    // Radix ticks the selected item with data-state; aria-selected follows focus.
    expect(screen.getByRole("option", { name: "Both tours" })).toHaveAttribute("data-state", "checked");
  });

  it("has no automatic entry for football, whose default is a league of its own", () => {
    render(
      <DashboardCompetitionPicker
        sportId="football"
        label="UEFA Champions League"
        competitions={FOOTBALL}
      />
    );

    open();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "UEFA Champions League",
      "LaLiga",
    ]);
    expect(screen.getByRole("option", { name: "UEFA Champions League" })).toHaveAttribute(
      "data-state",
      "checked"
    );
  });

  it("shows the choice at once and saves it, quietly busy until the card comes back", async () => {
    const save = deferred();
    render(<DashboardCompetitionPicker sportId="tennis" label="Both tours" competitions={TENNIS} />);

    open();
    fireEvent.click(screen.getByRole("option", { name: "WTA" }));

    expect(setSportCompetitionAction).toHaveBeenCalledWith({ sportId: "tennis", competition: "wta" });
    expect(trigger()).toHaveTextContent("WTA");
    expect(trigger()).toHaveAttribute("aria-busy", "true");

    await act(async () => save.resolve({ success: true }));

    // Nothing re-rendered the card here, so the line is the one it was given.
    expect(trigger()).toHaveAttribute("aria-busy", "false");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stores null for the card's own pick", async () => {
    const save = deferred();
    render(
      <DashboardCompetitionPicker
        sportId="lol"
        label="LCK Split 3 · Finals"
        competitions={{
          value: "lck",
          automatic: "Follow what's on",
          options: [
            { id: "worlds", label: "Worlds 2026" },
            { id: "lck", label: "LCK Split 3" },
          ],
        }}
      />
    );

    open();
    fireEvent.click(screen.getByRole("option", { name: "Follow what's on" }));

    expect(setSportCompetitionAction).toHaveBeenCalledWith({ sportId: "lol", competition: null });
    expect(trigger()).toHaveTextContent("Follow what's on");
    await act(async () => save.resolve({ success: true }));
  });

  it("ticks a stored event that is not on, and clears it for the card's own pick", async () => {
    const save = deferred();
    render(
      <DashboardCompetitionPicker
        sportId="lol"
        label="Worlds 2026 · Swiss"
        competitions={{
          value: null,
          automatic: "Follow what's on",
          options: [{ id: "worlds", label: "Worlds 2026" }],
          waiting: { id: "msi", label: "MSI" },
        }}
      />
    );

    open();
    const waiting = screen.getByRole("option", { name: "MSI · when it's on" });
    expect(waiting).toHaveAttribute("data-state", "checked");
    expect(waiting).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "Follow what's on" })).toHaveAttribute(
      "data-state",
      "unchecked"
    );

    // The card already follows what's on, but the row still holds MSI and
    // would switch back to it when it returns.
    fireEvent.click(screen.getByRole("option", { name: "Follow what's on" }));

    expect(setSportCompetitionAction).toHaveBeenCalledWith({ sportId: "lol", competition: null });
    expect(trigger()).toHaveTextContent("Follow what's on");
    await act(async () => save.resolve({ success: true }));
  });

  it("saves nothing when the choice is the one already shown", () => {
    render(<DashboardCompetitionPicker sportId="tennis" label="Both tours" competitions={TENNIS} />);

    open();
    fireEvent.click(screen.getByRole("option", { name: "Both tours" }));

    expect(setSportCompetitionAction).not.toHaveBeenCalled();
  });

  it("goes back to the line it had when the change is refused", async () => {
    const save = deferred();
    render(<DashboardCompetitionPicker sportId="tennis" label="Both tours" competitions={TENNIS} />);

    open();
    fireEvent.click(screen.getByRole("option", { name: "ATP" }));
    expect(trigger()).toHaveTextContent("ATP");

    await act(async () =>
      save.resolve({ success: false, error: "Add this sport to your favorites first" })
    );

    expect(toast.error).toHaveBeenCalledWith("Add this sport to your favorites first");
    expect(trigger()).toHaveTextContent("Both tours");
    expect(trigger()).toHaveAttribute("aria-busy", "false");
  });
});
