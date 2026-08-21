// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TripPayments, type PaymentsTraveller } from "./trip-payments";
import type { TripContribution } from "@/types/travel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/travel", () => ({
  addTripContributionAction: vi.fn(),
  deleteTripContributionAction: vi.fn(),
}));

const TRAVELLERS: PaymentsTraveller[] = [
  { id: "j", name: "Jason Hume", isYou: true, owedLow: 2300, owedHigh: 2500 },
  { id: "b", name: "Bruno Fabián", isYou: false, owedLow: 2300, owedHigh: 2500 },
];

const paid = (over: Partial<TripContribution>): TripContribution =>
  ({
    id: "c1",
    tripId: "t1",
    memberId: "b",
    amount: "300.00",
    note: null,
    paidOn: "2026-08-16",
    createdAt: new Date(),
    ...over,
  }) as TripContribution;

const CONTRIBUTIONS = [paid({}), paid({ id: "c2", memberId: "j", amount: "500.00" })];

function renderCard(selected: string | null) {
  return render(
    <TripPayments
      tripId="t1"
      currency="USD"
      travellers={TRAVELLERS}
      contributions={CONTRIBUTIONS}
      selected={selected}
    />
  );
}

describe("TripPayments", () => {
  it("adds up everybody when nobody is selected", () => {
    renderCard(null);

    expect(screen.getByText("$800")).toBeInTheDocument();
    expect(screen.getByText("of $4,600 – $5,000")).toBeInTheDocument();
  });

  it("narrows to one traveller's payments when they are selected", () => {
    renderCard("b");

    // Twice: the headline, and the single row that makes it up.
    expect(screen.getAllByText("$300")).toHaveLength(2);
    expect(screen.getByText("of $2,300 – $2,500")).toBeInTheDocument();
    // Jason's $500 belongs to Jason.
    expect(screen.queryByText("$500")).not.toBeInTheDocument();
  });

  it("shows what a payment leaves outstanding", () => {
    renderCard("b");

    expect(screen.getByText(/\$2,000 still to go/)).toBeInTheDocument();
  });

  it("keeps the paid figure exact while the estimate stays a range", () => {
    // Money either moved or it did not. Rendering what was paid as a range
    // too would suggest the bank statement is also a guess.
    renderCard("b");

    expect(screen.getAllByText("$300").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$300 – /)).not.toBeInTheDocument();
  });

  it("names who paid only when the list mixes people", () => {
    renderCard(null);
    expect(screen.getByText("Bruno Fabián")).toBeInTheDocument();

    renderCard("b");
    // Once, in the header badge — not repeated on every line of their own list.
    expect(screen.getAllByText("Bruno Fabián")).toHaveLength(2);
  });

  it("says so plainly when a traveller has paid nothing", () => {
    render(
      <TripPayments
        tripId="t1"
        currency="USD"
        travellers={TRAVELLERS}
        contributions={[]}
        selected="j"
      />
    );

    expect(screen.getByText("Nothing from you yet.")).toBeInTheDocument();
  });

  it("refuses to take a payment before there is anybody to take it from", () => {
    render(
      <TripPayments
        tripId="t1"
        currency="USD"
        travellers={[]}
        contributions={[]}
        selected={null}
      />
    );

    expect(screen.getByText("No travellers yet")).toBeInTheDocument();
    expect(screen.queryByText("Log payment")).not.toBeInTheDocument();
  });
});

describe("TripPayments records", () => {
  it("makes the whole record the target rather than a hover button", () => {
    // The delete button used to hold space at the right of every row, which
    // is what pushed each amount off the card's edge.
    renderCard(null);

    expect(screen.queryByLabelText("Delete payment")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Bruno Fabián/ }).length).toBeGreaterThan(0);
  });

  it("opens the record when it is tapped", () => {
    renderCard("b");

    fireEvent.click(screen.getByRole("button", { name: /\$300/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});
