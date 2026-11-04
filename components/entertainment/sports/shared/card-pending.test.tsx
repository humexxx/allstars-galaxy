// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardPendingProvider, PendingArea, useCardTransition } from "./card-pending";

function Change(): React.ReactElement {
  const [, startTransition] = useCardTransition();
  return (
    <button type="button" onClick={() => startTransition(() => new Promise<void>(() => {}))}>
      Change
    </button>
  );
}

function renderCard(): void {
  render(
    <CardPendingProvider>
      <Change />
      <PendingArea skeleton="box">
        <a href="/game">The game</a>
      </PendingArea>
      <PendingArea skeleton="list">
        <h3>Table</h3>
      </PendingArea>
      <p>The news</p>
    </CardPendingProvider>
  );
}

describe("PendingArea", () => {
  it("shows its content, with no skeleton, until the card changes", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "The game" }).closest(".invisible")).toBeNull();
    expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(0);
    expect(document.querySelector("[aria-busy]")).toBeNull();
  });

  it("keeps its content in place, hidden and out of reach, under a skeleton while the card changes", async () => {
    renderCard();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Change" }));
    });

    // jsdom has no stylesheet: the hiding is the class.
    const wrapper = screen.getByText("The game").parentElement!;
    expect(wrapper).toHaveClass("invisible");
    expect(wrapper).toHaveAttribute("inert");
    expect(document.querySelectorAll("[aria-busy=true]")).toHaveLength(2);
    // The box is one block; the list an eyebrow over its rows.
    expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(1 + 13);
    // What the change does not replace stays as it is.
    expect(screen.getByText("The news").closest(".invisible")).toBeNull();
  });

  it("never pends outside a card", () => {
    render(
      <PendingArea skeleton="box">
        <span>Alone</span>
      </PendingArea>
    );
    expect(screen.getByText("Alone").closest(".invisible")).toBeNull();
  });
});
