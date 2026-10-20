// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/travel", () => ({
  createTripShareAction: vi.fn(),
  deleteTripShareAction: vi.fn(),
  revokeTripShareAction: vi.fn(),
  updateTripShareExpiryAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { createTripShareAction, updateTripShareExpiryAction } from "@/app/actions/travel";
import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { TripShare, TripWithRelations } from "@/types/travel";

import { TripSharePanel } from "./trip-share-panel";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
// Oct 18 2026, 23:30 in Los Angeles — already Oct 19 in UTC.
const NOW = new Date("2026-10-19T06:30:00Z");
const LA = "America/Los_Angeles";
/** End of Jan 16, 2027 on a Los Angeles clock. */
const TRIP_END_LA = new Date("2027-01-17T07:59:59.999Z");

function share(overrides: Partial<TripShare> = {}): TripShare {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    tripId: TRIP_ID,
    token: "tok",
    inviteeEmail: null,
    memberId: null,
    expiresAt: null,
    revokedAt: null,
    showPrices: false,
    showMembers: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

function trip(overrides: Partial<TripWithRelations> = {}): TripWithRelations {
  return {
    id: TRIP_ID,
    title: "Orlando",
    startDate: "2027-01-10",
    endDate: "2027-01-16",
    members: [],
    items: [],
    photos: [],
    shares: [],
    contributions: [],
    ...overrides,
  } as unknown as TripWithRelations;
}

function renderPanel(t: TripWithRelations, timeZone = LA) {
  return render(
    <ReaderTimeZoneProvider timeZone={timeZone}>
      <TripSharePanel trip={t} baseUrl="https://example.com" />
    </ReaderTimeZoneProvider>
  );
}

/** Opens a Radix Select from the keyboard and picks an option by name. */
function choose(trigger: HTMLElement, option: string | RegExp) {
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeAll(() => {
  // jsdom has no layout: Radix Select scrolls its options into view and
  // releases pointer capture, neither of which exists there.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.mocked(createTripShareAction).mockResolvedValue({
    success: true,
    data: share({ token: "new" }),
  });
  vi.mocked(updateTripShareExpiryAction).mockResolvedValue({ success: true, data: share() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("TripSharePanel — choosing how long a new link lasts", () => {
  // Two zones either side of Greenwich, so a panel that used the machine's
  // own zone would fail here wherever the suite runs.
  it.each([
    [LA, TRIP_END_LA],
    ["Asia/Tokyo", new Date("2027-01-16T14:59:59.999Z")],
  ])(
    "starts a trip with an end date on 'until the trip ends', ended on the clock in %s",
    async (timeZone, end) => {
      renderPanel(trip(), timeZone);

      expect(screen.getByLabelText("Expires")).toHaveTextContent("Until the trip ends");
      fireEvent.click(screen.getByRole("button", { name: "Create" }));

      // The last millisecond of Jan 16 there — not UTC midnight, which cuts
      // the trip's final evening off west of Greenwich.
      await waitFor(() =>
        expect(createTripShareAction).toHaveBeenCalledWith(
          TRIP_ID,
          expect.objectContaining({ expiresAt: end })
        )
      );
    }
  );

  it("starts an open-ended trip on 'never' and offers no trip end", () => {
    renderPanel(trip({ endDate: null }));

    const expires = screen.getByLabelText("Expires");
    expect(expires).toHaveTextContent("Never");
    fireEvent.keyDown(expires, { key: "ArrowDown" });
    expect(screen.queryByRole("option", { name: /Until the trip ends/ })).toBeNull();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "In 1 day",
      "In 7 days",
      "In 30 days",
      "On a date…",
      "Never",
    ]);
  });

  it("offers no trip end once the trip is over", () => {
    renderPanel(trip({ startDate: "2026-09-01", endDate: "2026-09-10" }));

    const expires = screen.getByLabelText("Expires");
    expect(expires).toHaveTextContent("Never");
    fireEvent.keyDown(expires, { key: "ArrowDown" });
    expect(screen.queryByRole("option", { name: /Until the trip ends/ })).toBeNull();
  });

  it("sends no expiry for a link that never expires", async () => {
    renderPanel(trip({ endDate: null }));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createTripShareAction).toHaveBeenCalledWith(
        TRIP_ID,
        expect.objectContaining({ expiresAt: null })
      )
    );
  });

  it("counts a preset from the click", async () => {
    renderPanel(trip());

    choose(screen.getByLabelText("Expires"), "In 7 days");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createTripShareAction).toHaveBeenCalledWith(
        TRIP_ID,
        expect.objectContaining({ expiresAt: new Date("2026-10-26T06:30:00Z") })
      )
    );
  });

  it("ends a picked day at the end of that day for the reader", async () => {
    renderPanel(trip({ endDate: null }));

    choose(screen.getByLabelText("Expires"), "On a date…");
    // A week from the reader's today (Oct 18 there), not from UTC's Oct 19.
    expect(screen.getByRole("button", { name: "Expiry day" })).toHaveTextContent(
      "Sun, 25 Oct 2026"
    );
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createTripShareAction).toHaveBeenCalledWith(
        TRIP_ID,
        expect.objectContaining({ expiresAt: new Date("2026-10-26T06:59:59.999Z") })
      )
    );
  });
});

describe("TripSharePanel — an active link's expiry", () => {
  it("prints when each link expires, in the reader's zone", () => {
    const { unmount } = renderPanel(
      trip({
        shares: [
          share({ id: "a", expiresAt: TRIP_END_LA }),
          share({ id: "b", token: "never", inviteeEmail: "ana@example.com" }),
        ],
      })
    );
    expect(screen.getByRole("button", { name: /^Expires Jan 16\./ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Never expires\./ })).toBeInTheDocument();
    unmount();

    // The same instant is already the 17th in Tokyo.
    renderPanel(trip({ shares: [share({ expiresAt: TRIP_END_LA })] }), "Asia/Tokyo");
    expect(screen.getByRole("button", { name: /^Expires Jan 17\./ })).toBeInTheDocument();
  });

  it("changes the expiry from the link's row", async () => {
    renderPanel(trip({ shares: [share({ expiresAt: TRIP_END_LA })] }));

    fireEvent.click(screen.getByRole("button", { name: /^Expires Jan 16\./ }));
    const popover = screen.getByRole("dialog");
    const select = within(popover).getByLabelText("Expires");
    // It opens on what the link already does.
    expect(select).toHaveTextContent("Until the trip ends");
    // Nothing to save until something changes.
    expect(within(popover).getByRole("button", { name: "Save" })).toBeDisabled();

    choose(select, "Never");
    fireEvent.click(within(popover).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateTripShareExpiryAction).toHaveBeenCalledWith(TRIP_ID, {
        shareId: share().id,
        expiresAt: null,
      })
    );
  });
});

describe("TripSharePanel — expired links", () => {
  const expired = share({ expiresAt: new Date("2026-10-01T06:59:59.999Z") });

  it("keeps the expired date, in the reader's zone", () => {
    const { unmount } = renderPanel(trip({ shares: [expired] }));
    expect(screen.getByText("expired Sep 30")).toBeInTheDocument();
    unmount();

    renderPanel(trip({ shares: [expired] }), "Asia/Tokyo");
    expect(screen.getByText("expired Oct 1")).toBeInTheDocument();
  });

  it("brings an expired link back with a future expiry", async () => {
    renderPanel(trip({ shares: [expired] }));

    fireEvent.click(screen.getByRole("button", { name: "Extend the link for anyone" }));
    const popover = screen.getByRole("dialog");
    // Its old day has passed, so it starts from the default rather than it.
    expect(within(popover).getByLabelText("Expires")).toHaveTextContent("Until the trip ends");
    fireEvent.click(within(popover).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateTripShareExpiryAction).toHaveBeenCalledWith(TRIP_ID, {
        shareId: expired.id,
        expiresAt: TRIP_END_LA,
      })
    );
  });

  it("offers nothing to extend on a revoked link", () => {
    renderPanel(
      trip({
        shares: [share({ ...expired, revokedAt: new Date("2026-09-15T12:00:00Z") })],
      })
    );

    expect(screen.queryByRole("button", { name: /^Extend/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Delete the record/ })).toBeInTheDocument();
  });
});
