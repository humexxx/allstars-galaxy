// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InvestmentMethodsView } from "./investment-methods-view";
import type { InvestmentMethod } from "@/types/portfolio";

vi.mock("@/components/dev-tools/dev-tools-context", () => ({
  useRegisterDevTool: vi.fn(),
}));

const MINE: InvestmentMethod = {
  id: "m1",
  name: "Safe Investment",
  description: "Steady monthly return",
  ownerUserId: "owner-1",
  createdAt: null,
  riskLevel: "Low",
  monthlyRoi: "0.7000",
  enabled: true,
} as InvestmentMethod;

const THEIRS: InvestmentMethod = {
  ...MINE,
  id: "m2",
  name: "Someone Else's Fund",
} as InvestmentMethod;

const ALLOCATIONS = [
  { methodId: "m1", allocations: [{ assetId: "a1", symbol: "ADA", percent: 100 }] },
  { methodId: "m2", allocations: [{ assetId: "a1", symbol: "BTC", percent: 100 }] },
];

describe("InvestmentMethodsView", () => {
  it("offers an edit control only on methods you run", () => {
    render(
      <InvestmentMethodsView
        methods={[MINE, THEIRS]}
        ownedMethodIds={["m1"]}
        allocations={ALLOCATIONS}
        onEditMethod={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Edit Safe Investment")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Someone Else's Fund")).not.toBeInTheDocument();
  });

  it("never shows the internal allocation of a method you do not run", () => {
    // The allocation is the owner's private half of the deal. Even when the
    // data is present in props, it must not reach a card the viewer does not
    // own — that is what keeps a client from seeing where their money goes.
    render(
      <InvestmentMethodsView
        methods={[MINE, THEIRS]}
        ownedMethodIds={["m1"]}
        allocations={ALLOCATIONS}
        onEditMethod={vi.fn()}
      />
    );

    expect(screen.getByText(/100% ADA/)).toBeInTheDocument();
    expect(screen.queryByText(/100% BTC/)).not.toBeInTheDocument();
  });

  it("shows a plain catalogue to someone who runs nothing", () => {
    render(<InvestmentMethodsView methods={[MINE, THEIRS]} />);

    expect(screen.queryByLabelText(/^Edit /)).not.toBeInTheDocument();
    expect(screen.queryByText(/100% ADA/)).not.toBeInTheDocument();
    // The catalogue itself still reads normally. (The name appears more than
    // once — card title and the grouped-by-author listing.)
    expect(screen.getAllByText("Safe Investment").length).toBeGreaterThan(0);
  });

  it("shows an owner their disabled methods too", () => {
    // They are yours whether or not they take new money. Hiding half of them
    // behind a dev toggle makes the tab lie about what exists.
    const closed = { ...MINE, id: "m3", name: "Closed Fund", enabled: false } as InvestmentMethod;

    render(
      <InvestmentMethodsView
        methods={[MINE, closed]}
        ownedMethodIds={["m1", "m3"]}
        allocations={[]}
        onEditMethod={vi.fn()}
      />
    );

    expect(screen.getAllByText("Closed Fund").length).toBeGreaterThan(0);
  });

  it("hides disabled methods from a client browsing the catalogue", () => {
    const closed = { ...MINE, id: "m3", name: "Closed Fund", enabled: false } as InvestmentMethod;

    render(<InvestmentMethodsView methods={[MINE, closed]} />);

    expect(screen.queryByText("Closed Fund")).not.toBeInTheDocument();
  });

  it("shows how much sits in each method you run", () => {
    render(
      <InvestmentMethodsView
        methods={[MINE]}
        ownedMethodIds={["m1"]}
        allocations={[]}
        capital={[
          { methodId: "m1", invested: 7700, holding: 8327.92, investorCount: 2 },
        ]}
        onEditMethod={vi.fn()}
      />
    );

    expect(screen.getByText("$7,700.00")).toBeInTheDocument();
    expect(screen.getByText(/2 investors/)).toBeInTheDocument();
  });

  it("never shows capital for a method the viewer does not run", () => {
    // A client browsing the catalogue has no business seeing other people's
    // money, so the prop simply carries nothing for those cards.
    render(<InvestmentMethodsView methods={[MINE, THEIRS]} />);

    expect(screen.queryByText("Invested")).not.toBeInTheDocument();
  });

  it("says so when an owned method has no allocation yet", () => {
    render(
      <InvestmentMethodsView
        methods={[MINE]}
        ownedMethodIds={["m1"]}
        allocations={[]}
        onEditMethod={vi.fn()}
      />
    );

    expect(screen.getByText(/no allocation set/i)).toBeInTheDocument();
  });
});
