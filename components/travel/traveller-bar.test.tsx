// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TravellerBar } from "./traveller-bar";

const TRAVELLERS = [
  { id: "j", name: "Jason Hume", owed: 2300, isYou: true },
  { id: "b", name: "Bruno Fabián", owed: 2300 },
];

function renderBar() {
  return render(
    <TravellerBar
      travellers={TRAVELLERS}
      total={4600}
      totalHigh={5000}
      currency="USD"
      onManage={vi.fn()}
    />
  );
}

describe("TravellerBar", () => {
  it("shows the trip total by default", () => {
    // The total is the anchor: it is the one figure that does not move when a
    // different face is clicked.
    renderBar();

    expect(screen.getByText("$4,600 – $5,000")).toBeInTheDocument();
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("swaps to a traveller's share when they are selected", () => {
    renderBar();

    fireEvent.click(screen.getByTitle(/Bruno Fabián/));
    expect(screen.getByText("$2,300")).toBeInTheDocument();
    expect(screen.getByText("Bruno Fabián pays")).toBeInTheDocument();
  });

  it("says 'you pay' rather than naming the signed-in traveller", () => {
    renderBar();

    fireEvent.click(screen.getByTitle(/Jason Hume \(you\)/));
    expect(screen.getByText("you pay")).toBeInTheDocument();
  });

  it("offers an explicit way back to the total", () => {
    // Clicking the selected face again also works, but nothing said so.
    renderBar();

    fireEvent.click(screen.getByTitle(/Bruno Fabián/));
    fireEvent.click(screen.getByText("All"));
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("deselects when the same traveller is clicked twice", () => {
    renderBar();

    const bruno = screen.getByTitle(/Bruno Fabián/);
    fireEvent.click(bruno);
    fireEvent.click(bruno);
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("invites adding people when the trip has none", () => {
    render(
      <TravellerBar
        travellers={[]}
        total={0}
        totalHigh={0}
        currency="USD"
        onManage={vi.fn()}
      />
    );

    expect(screen.getByText("Add travellers")).toBeInTheDocument();
  });
});
