import { describe, expect, it } from "vitest";

import { viewerItems, type ItineraryViewer } from "./viewer";

const item = (id: string, attendeeIds: string[] = []) => ({ id, attendeeIds });

const viewer = (memberId: string | null): ItineraryViewer => ({
  memberId,
  name: "Whoever",
  isYou: false,
  lines: new Map(),
});

describe("viewerItems", () => {
  const plan = [
    item("sjo-kef", ["jason", "jafet"]),
    item("mex-kef", ["ana"]),
    item("mia-kef", ["ale"]),
    item("hotel"),
    // Everybody goes; only Jason and Jafet pay. Attendees is what decides
    // whose itinerary it is on, so it is on all four.
    item("tomorrowland"),
  ];

  it("hands back the whole plan when nobody is selected", () => {
    expect(viewerItems(plan, null)).toHaveLength(5);
  });

  it("drops the items a traveller is not on", () => {
    const mine = viewerItems(plan, viewer("jafet"));
    expect(mine.map((i) => i.id)).toEqual(["sjo-kef", "hotel", "tomorrowland"]);
  });

  it("keeps what everybody is on, whoever pays for it", () => {
    // The case that broke when this filtered on payers: Ana is invited to the
    // festival and it vanished off her itinerary.
    expect(viewerItems(plan, viewer("ana")).map((i) => i.id)).toEqual([
      "mex-kef",
      "hotel",
      "tomorrowland",
    ]);
  });

  it("does not narrow a viewer with no member behind it", () => {
    // A public scoped link: the service already filtered, and the member ids
    // never reach the browser.
    expect(viewerItems(plan, viewer(null))).toHaveLength(5);
  });
});
