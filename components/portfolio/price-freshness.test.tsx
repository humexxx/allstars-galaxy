// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/price-refresh", () => ({ refreshPricesAction: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { refreshPricesAction } from "@/app/actions/price-refresh";
import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";

import { PriceFreshness } from "./price-freshness";

// 9:00 PM in Costa Rica, 2 h 29 min after the 00:30 UTC price run.
const NOW = new Date("2026-10-20T03:00:00Z");
const DAILY = { minute: 30, hour: 0 };
const TODAYS_RUN = "2026-10-20T00:30:44.946Z";

const renderIn = (ui: React.ReactElement): ReturnType<typeof render> =>
  render(<ReaderTimeZoneProvider timeZone="America/Costa_Rica">{ui}</ReaderTimeZoneProvider>);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("PriceFreshness", () => {
  it("says how old the prices are and when the next run is due", () => {
    renderIn(
      <PriceFreshness
        quotes={[{ symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN }]}
        schedule={DAILY}
      />
    );
    expect(screen.getByRole("button", { name: /prices updated/i })).toHaveTextContent(
      "Prices updated 2 h ago · next in 21 h"
    );
  });

  it("reports the oldest price, since the page is only as fresh as that", () => {
    renderIn(
      <PriceFreshness
        quotes={[
          { symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN },
          { symbol: "SPY", source: "massive", fetchedAt: "2026-10-18T00:30:00.000Z" },
        ]}
        schedule={DAILY}
      />
    );
    const label = screen.getByRole("button", { name: /prices updated/i });
    expect(label).toHaveTextContent("Prices updated 2 d ago");
    // SPY missed yesterday's run and today's: overdue reads as a warning.
    expect(label).toHaveClass("text-warning");
  });

  it("opens the exact times on a tap, in the reader's zone", () => {
    renderIn(
      <PriceFreshness
        quotes={[{ symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN }]}
        schedule={DAILY}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /prices updated/i }));
    const details = screen.getByRole("tooltip");
    expect(details).toHaveTextContent("Updated Oct 19, 2026, 6:30 PM");
    expect(details).toHaveTextContent("Next price run Oct 20, 2026, 6:30 PM");
  });

  it("drops the next-run part when the schedule cannot be read", () => {
    renderIn(
      <PriceFreshness
        quotes={[{ symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN }]}
        schedule={null}
      />
    );
    expect(screen.getByRole("button", { name: /prices updated/i })).toHaveTextContent(
      /^Prices updated 2 h ago$/
    );
  });

  it("renders nothing for a book with no fetched prices", () => {
    const { container } = renderIn(
      <PriceFreshness
        quotes={[{ symbol: "PRIV", source: "manual", fetchedAt: TODAYS_RUN }]}
        schedule={DAILY}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the refresh as pending until the action settles", async () => {
    let settle: (value: Awaited<ReturnType<typeof refreshPricesAction>>) => void = () => {};
    vi.mocked(refreshPricesAction).mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      })
    );
    renderIn(
      <PriceFreshness
        quotes={[{ symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN }]}
        schedule={DAILY}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const pending = screen.getByRole("button", { name: "Refreshing…" });
    expect(pending).toBeDisabled();

    await act(async () => {
      settle({ success: true, data: { status: "current", newerAt: "2026-10-21T00:00:00.000Z" } });
    });

    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(toast.info).toHaveBeenCalledWith(
      "Already the latest prices. Newer ones from Oct 20, 2026, 6:00 PM."
    );
  });

  it("toasts the reason when the refresh is refused", async () => {
    vi.mocked(refreshPricesAction).mockResolvedValueOnce({
      success: false,
      error: "Prices were refreshed moments ago. Try again in 4 min.",
    });
    renderIn(
      <PriceFreshness
        quotes={[{ symbol: "ADA", source: "massive", fetchedAt: TODAYS_RUN }]}
        schedule={DAILY}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Prices were refreshed moments ago. Try again in 4 min."
    );
  });
});
