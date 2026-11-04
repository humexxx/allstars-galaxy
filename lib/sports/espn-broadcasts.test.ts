import { describe, expect, it } from "vitest";

import { headerBroadcasts, siteBroadcasts } from "./espn-broadcasts";

describe("headerBroadcasts", () => {
  it("splits ESPN's national line and puts TV before streaming", () => {
    expect(
      headerBroadcasts({
        broadcast: "Peacock/NBC",
        broadcasts: [
          { name: "Peacock", type: "Streaming" },
          { name: "NBC", type: "TV" },
          { name: "Spectrum Sports Network", type: "TV" },
        ],
      })
    ).toEqual(["NBC", "Peacock"]);
  });

  it("names nothing for a game on League Pass and regional networks only", () => {
    expect(
      headerBroadcasts({
        broadcast: "",
        broadcasts: [
          { name: "NBA League Pass", type: "Subscription Package" },
          { name: "KFAA-TV", type: "TV" },
        ],
      })
    ).toEqual([]);
    expect(headerBroadcasts({ broadcast: null })).toEqual([]);
    expect(headerBroadcasts({})).toEqual([]);
  });

  it("keeps a name ESPN does not list by kind where it stands", () => {
    // The line says "NBA TV", the list "NBATV".
    expect(headerBroadcasts({ broadcast: "NBA TV", broadcasts: [{ name: "NBATV", type: "TV" }] })).toEqual([
      "NBA TV",
    ]);
  });
});

describe("siteBroadcasts", () => {
  it("takes the national market only, TV first", () => {
    expect(
      siteBroadcasts({
        broadcasts: [
          { market: "national", names: ["Disney+", "ESPN", "ABC"] },
          { market: "home", names: ["WFOR"] },
        ],
        geoBroadcasts: [{ media: { shortName: "Disney+" }, type: { shortName: "Streaming" } }],
      })
    ).toEqual(["ESPN", "ABC", "Disney+"]);
  });

  it("names nothing without a national market", () => {
    expect(siteBroadcasts({ broadcasts: [{ market: "away", names: ["NBA League Pass"] }] })).toEqual([]);
    expect(siteBroadcasts(undefined)).toEqual([]);
  });
});
