// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TravellerBar, moneyRange, type TravellerView } from "./traveller-bar";

const TRAVELLERS: TravellerView[] = [
  { id: "j", name: "Jason Hume", owedLow: 2300, owedHigh: 2500, isYou: true },
  { id: "b", name: "Bruno Fabián", owedLow: 2300, owedHigh: 2500 },
];

/** The bar is controlled; the parent owns the selection because it also
 *  re-costs the itinerary. This stands in for that parent. */
function Harness({ travellers = TRAVELLERS }: { travellers?: TravellerView[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <TravellerBar
      travellers={travellers}
      total={4600}
      totalHigh={5000}
      currency="USD"
      selected={selected}
      onSelect={setSelected}
      onManage={vi.fn()}
    />
  );
}

describe("moneyRange", () => {
  it("collapses to one figure when the ends agree", () => {
    expect(moneyRange(3800, 3800, "USD")).toBe("$3,800");
  });

  it("shows both ends when they do not", () => {
    expect(moneyRange(600, 800, "USD")).toBe("$600 – $800");
  });
});

describe("TravellerBar", () => {
  it("shows the trip total by default", () => {
    // The total is the anchor: it is the one figure that does not move when a
    // different face is clicked.
    render(<Harness />);

    expect(screen.getByText("$4,600 – $5,000")).toBeInTheDocument();
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("swaps to a traveller's share when they are selected", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTitle(/Bruno Fabián/));
    expect(screen.getByText("$2,300 – $2,500")).toBeInTheDocument();
    expect(screen.getByText("Bruno Fabián pays")).toBeInTheDocument();
  });

  it("keeps a person's share a range too", () => {
    // A trip made of estimates cannot give anybody an exact bill. Showing the
    // low end alone made a $2,300–$2,500 share read as settled.
    render(<Harness />);

    fireEvent.click(screen.getByTitle(/Bruno Fabián/));
    expect(screen.queryByText("$2,300")).not.toBeInTheDocument();
  });

  it("says 'you pay' rather than naming the signed-in traveller", () => {
    render(<Harness />);

    fireEvent.click(screen.getByTitle(/Jason Hume \(you\)/));
    expect(screen.getByText("you pay")).toBeInTheDocument();
  });

  it("offers an explicit way back to the total", () => {
    // Clicking the selected face again also works, but nothing said so.
    render(<Harness />);

    fireEvent.click(screen.getByTitle(/Bruno Fabián/));
    fireEvent.click(screen.getByText("All"));
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("deselects when the same traveller is clicked twice", () => {
    render(<Harness />);

    const bruno = screen.getByTitle(/Bruno Fabián/);
    fireEvent.click(bruno);
    fireEvent.click(bruno);
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });

  it("invites adding people when the trip has none", () => {
    render(<Harness travellers={[]} />);

    expect(screen.getByText("Add travellers")).toBeInTheDocument();
  });
});
