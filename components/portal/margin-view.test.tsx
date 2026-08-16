// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarginView } from "./margin-view";
import type { MethodMargin } from "@/lib/finance/margin";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/allocations", () => ({
  setAllocationsAction: vi.fn(),
  repriceContributionsAction: vi.fn(),
  createPriceAssetAction: vi.fn(),
  setManualPriceAction: vi.fn(),
}));

const ASSETS = [
  { id: "asset-ada", symbol: "ADA", name: "Cardano", source: "coingecko" },
];

function method(over: Partial<MethodMargin> = {}): MethodMargin {
  return {
    methodId: "m1",
    methodName: "Safe Investment",
    liability: 7277.87,
    ownPosition: 1050.05,
    assets: 9000,
    margin: 1722.13,
    marginPercent: 23.66,
    holdings: [
      {
        id: "h1",
        assetId: "asset-ada",
        symbol: "ADA",
        name: "Cardano",
        quantity: 51020.4,
        price: 0.1764,
        costBasis: 6700,
      },
    ],
    incomplete: false,
    ...over,
  };
}

function renderView(over: Partial<Parameters<typeof MarginView>[0]> = {}) {
  const m = over.methods ?? [method()];
  return render(
    <MarginView
      methods={m}
      totals={{
        liability: m.reduce((s, x) => s + x.liability, 0),
        assets: m.reduce((s, x) => s + x.assets, 0),
        margin: m.reduce((s, x) => s + x.margin, 0),
        incomplete: m.some((x) => x.incomplete),
      }}
      unconfigured={false}
      assets={ASSETS}
      allocations={[]}
      investors={[]}
      {...over}
    />
  );
}

describe("MarginView", () => {
  it("shows the three headline figures", () => {
    renderView();

    expect(screen.getByText("Deployed value")).toBeInTheDocument();
    expect(screen.getByText("Owed to investors")).toBeInTheDocument();
    expect(screen.getByText("Margin")).toBeInTheDocument();
  });

  it("says plainly when the promise is being covered out of pocket", () => {
    renderView({ methods: [method({ assets: 5000, margin: -2277.87 })] });

    expect(
      screen.getByText(/covering the promise out of pocket/i)
    ).toBeInTheDocument();
  });

  it("frames a positive margin as what is left after paying everyone", () => {
    renderView();

    expect(screen.getByText(/yours after paying everyone/i)).toBeInTheDocument();
  });

  it("calls the owner's own stake capital rather than debt", () => {
    renderView();

    expect(screen.getByText(/is capital, not debt/i)).toBeInTheDocument();
  });

  it("flags an unpriced holding instead of valuing it at zero", () => {
    renderView({
      methods: [
        method({
          incomplete: true,
          holdings: [
            {
              id: "h1",
              assetId: "asset-ada",
              symbol: "ADA",
              name: "Cardano",
              quantity: 100,
              price: null,
              costBasis: 50,
            },
          ],
        }),
      ],
    });

    expect(screen.getByText("no price")).toBeInTheDocument();
    expect(screen.getByText(/deployed value is understated/i)).toBeInTheDocument();
  });

  it("masks every figure when values are hidden", () => {
    renderView({ hideValues: true });

    expect(screen.queryByText(/\$9,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$7,277/)).not.toBeInTheDocument();
    // The bullet mask stands in, keeping the same width as the real number.
    expect(screen.getAllByText(/•{3,}/).length).toBeGreaterThan(0);
  });

  it("keeps the percentages readable once the amounts are masked", () => {
    // The point of masked mode: you can still tell how things stand without
    // showing anyone how much money is involved. Balances go, shares stay.
    const { container } = renderView({ hideValues: true });

    for (const balance of ["9,000", "7,277", "1,722", "1,050", "6,700", "2,300"]) {
      expect(container.textContent).not.toContain(balance);
    }
    // 9000 deployed against 7277.87 owed, and the margin as a share of it.
    expect(container.textContent).toContain("123.7%");
    expect(container.textContent).toContain("+23.7%");
  });

  it("still prices individual holdings when totals are hidden", () => {
    // A unit price is not a balance — hiding it would make the table
    // unreadable without protecting anything.
    renderView({ hideValues: true });

    expect(screen.getByText("$0.18")).toBeInTheDocument();
  });

  it("explains itself when nobody runs a method", () => {
    renderView({ methods: [] });

    expect(screen.getByText(/no investment methods yet/i)).toBeInTheDocument();
  });

  it("prompts to price contributions before anything has been valued", () => {
    renderView({ unconfigured: true });

    expect(screen.getByText(/no contribution has been priced yet/i)).toBeInTheDocument();
  });

  it("shows each method's allocation policy so the next contribution is predictable", () => {
    renderView({
      allocations: [
        {
          methodId: "m1",
          allocations: [{ assetId: "asset-ada", symbol: "ADA", percent: 100 }],
        },
      ],
    });

    expect(screen.getByText(/100% ADA/)).toBeInTheDocument();
  });

  it("reports profit and loss against what was actually invested", () => {
    // 51,020.4 ADA bought for $6,700, now worth $0.1764 each = $9,000.
    renderView();

    expect(screen.getByText("$2,300.00")).toBeInTheDocument();
  });
});
