// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const mixed = renderCard(null);
    expect(
      within(mixed.container.querySelector("ul")!).getByText("Bruno Fabián")
    ).toBeInTheDocument();

    const focused = renderCard("b");
    // The rows carry no name: the card already says whose list this is.
    expect(
      within(focused.container.querySelector("ul")!).queryByText("Bruno Fabián")
    ).toBeNull();
  });

  it("logs a payment through the same dialog that corrects one", () => {
    // Both ask for the same four things. Separate forms made them look like
    // different work and had to be kept in step by hand.
    renderCard("b");

    fireEvent.click(screen.getByRole("button", { name: /Log payment/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Amount")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Paid on")).toBeInTheDocument();
    // Nothing to remove yet.
    expect(within(dialog).queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("does not ask who paid when the card has already answered it", () => {
    renderCard("b");

    fireEvent.click(screen.getByRole("button", { name: /Log payment/i }));
    expect(within(screen.getByRole("dialog")).queryByText("Who paid")).toBeNull();
  });

  it("asks who paid when the list is everybody's", () => {
    renderCard(null);

    fireEvent.click(screen.getByRole("button", { name: /Log payment/i }));
    expect(within(screen.getByRole("dialog")).getByText("Who paid")).toBeInTheDocument();
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

describe("the payment dialog's date", () => {
  it("offers today in the reader's own timezone", () => {
    // `toISOString()` west of Greenwich in the evening already reads as
    // tomorrow, so a payment logged tonight was dated for a day that has not
    // happened yet.
    renderCard("b");
    fireEvent.click(screen.getByRole("button", { name: /Log payment/i }));

    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    expect(
      (within(screen.getByRole("dialog")).getByLabelText("Paid on") as HTMLInputElement).value
    ).toBe(local);
  });

  it("associates every label with its control", () => {
    // getByLabel finding nothing is a screen reader finding nothing.
    renderCard(null);
    fireEvent.click(screen.getByRole("button", { name: /Log payment/i }));
    const dialog = within(screen.getByRole("dialog"));

    expect(dialog.getByLabelText("Who paid")).toBeInTheDocument();
    expect(dialog.getByLabelText("Amount")).toBeInTheDocument();
    expect(dialog.getByLabelText("Paid on")).toBeInTheDocument();
  });
});
