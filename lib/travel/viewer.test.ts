import { describe, expect, it } from "vitest";

import { viewerItems, type ItineraryViewer } from "./viewer";

const item = (id: string, payerIds: string[] = []) => ({ id, payerIds });

const viewer = (memberId: string | null): ItineraryViewer => ({
  memberId,
  name: "Jafet",
  isYou: false,
  lines: new Map(),
});

describe("viewerItems", () => {
  const plan = [
    item("sjo-kef", ["jason", "jafet"]),
    item("mex-kef", ["ana"]),
    item("mia-kef", ["ale"]),
    item("hotel"),
  ];

  it("hands back the whole plan when nobody is selected", () => {
    expect(viewerItems(plan, null)).toHaveLength(4);
  });

  it("drops the items a traveller has no part in", () => {
    // Ana's flight from Mexico was showing on Jafet's itinerary worth $0,
    // which says nothing except that it is not his.
    const mine = viewerItems(plan, viewer("jafet"));
    expect(mine.map((i) => i.id)).toEqual(["sjo-kef", "hotel"]);
  });

  it("keeps what nobody in particular pays for", () => {
    // An item with no payers named is the trip's, so it is everybody's.
    expect(viewerItems(plan, viewer("ana")).map((i) => i.id)).toEqual([
      "mex-kef",
      "hotel",
    ]);
  });

  it("does not narrow a viewer with no member behind it", () => {
    // A public scoped link: the service already filtered, and the member ids
    // never reach the browser.
    expect(viewerItems(plan, viewer(null))).toHaveLength(4);
  });
});
