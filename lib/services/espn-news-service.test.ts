import { afterEach, describe, expect, it, vi } from "vitest";

import { __testing, getEspnNews } from "./espn-news-service";

const { newsUrl, storyFrom, inReadingOrder } = __testing;

// ESPN's /news, trimmed to what the mapper reads (NBA, 2026-10-24).
const article = (over: Record<string, unknown> = {}) => ({
  id: 50263163,
  type: "HeadlineNews",
  headline: "Giannis Antetokounmpo stays hot with 36 in loss",
  description: "Antetokounmpo scored 36 points Friday.",
  published: "2026-10-24T04:36:05Z",
  premium: false,
  images: [
    { type: "header", url: "https://a.espncdn.com/photo/2026/1024/r1735332_600x400_3-2.jpg", width: 600, height: 400, alt: "Giannis" },
    { type: "Media", url: "https://espnmedia-cdn.akamaized.net/clip.jpg", width: 576, height: 324 },
  ],
  links: { web: { href: "http://www.espn.com/nba/story/_/id/50263163/giannis" } },
  categories: [
    { type: "league", description: "NBA" },
    { type: "team", description: "Miami Heat" },
    { type: "athlete", description: "Giannis Antetokounmpo" },
  ],
  ...over,
});

describe("storyFrom", () => {
  it("maps an article, opened at the source over https, with its widest photograph", () => {
    expect(storyFrom(article())).toEqual({
      id: "espn-50263163",
      headline: "Giannis Antetokounmpo stays hot with 36 in loss",
      description: "Antetokounmpo scored 36 points Friday.",
      href: "https://www.espn.com/nba/story/_/id/50263163/giannis",
      external: true,
      image: { url: "https://a.espncdn.com/photo/2026/1024/r1735332_600x400_3-2.jpg", alt: "Giannis" },
      at: "2026-10-24T04:36:05Z",
      kind: "story",
      about: ["Miami Heat", "Giannis Antetokounmpo"],
    });
  });

  it("gives a recap no picture rather than its two logos on a card", () => {
    const recap = storyFrom(
      article({
        type: "Recap",
        images: [{ type: "stitcher", url: "https://s.espncdn.com/stitcher/sports/basketball/nba/events/1.png", width: 308 }],
      })
    );
    expect(recap).toMatchObject({ kind: "recap", image: null });
  });

  it("calls a clip a video", () => {
    expect(storyFrom(article({ type: "Media" }))?.kind).toBe("video");
  });

  it("leaves out what a reader could not open: ESPN+, or nothing to link to", () => {
    expect(storyFrom(article({ premium: true }))).toBeNull();
    expect(storyFrom(article({ links: {} }))).toBeNull();
  });
});

describe("newsUrl", () => {
  it("asks for a feed's own edition where espn.com's has gone quiet", () => {
    expect(newsUrl("mls")).toBe("https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/news?limit=24");
    expect(newsUrl("costa-rica")).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/crc.1/news?limit=24&lang=es&region=cr"
    );
  });
});

describe("inReadingOrder", () => {
  // The NBA wire of 2026-11-15, by where espn.com filed each piece.
  const filed = (id: number, path: string, published: string) =>
    storyFrom(article({ id, published, links: { web: { href: `https://www.espn.com/${path}/_/id/${id}/slug` } } }))!;

  it("puts the league's own stories above its fantasy and betting asides, each newest first", () => {
    const wire = [
      filed(1, "fantasy/basketball/story", "2026-11-15T15:57:00Z"),
      filed(2, "nba/story", "2026-11-15T12:00:00Z"),
      filed(3, "espn/betting/story", "2026-11-15T23:00:00Z"),
      filed(4, "video/clip", "2026-11-15T09:00:00Z"),
      filed(5, "nba/recap", "2026-11-15T20:00:00Z"),
    ];
    expect(inReadingOrder("nba", wire).map((s) => s.id)).toEqual(["espn-5", "espn-2", "espn-4", "espn-3", "espn-1"]);
  });

  it("drops only what is filed under another sport's desk", () => {
    const wire = [
      filed(1, "soccer/story", "2026-11-15T17:30:00Z"),
      filed(2, "nba/story", "2026-11-15T12:00:00Z"),
      filed(3, "espn/story", "2026-11-15T11:00:00Z"),
      filed(4, "college-football/story", "2026-11-15T10:00:00Z"),
    ];
    expect(inReadingOrder("nba", wire).map((s) => s.id)).toEqual(["espn-2", "espn-3"]);
    expect(inReadingOrder("la-liga", wire).map((s) => s.id)).toEqual(["espn-1", "espn-3"]);
  });

  it("keeps a tour's and another edition's stories: tennis for the ATP, futbol for Costa Rica", () => {
    const tennis = [filed(1, "tennis/story", "2026-11-15T22:46:00Z")];
    expect(inReadingOrder("atp", tennis)).toEqual(tennis);
    const tica = [
      storyFrom(article({ id: 7, links: { web: { href: "https://www.espn.co.cr/futbol/costa-rica/nota/_/id/7/saprissa" } } }))!,
    ];
    expect(inReadingOrder("costa-rica", tica)).toEqual(tica);
  });
});

describe("getEspnNews", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))));
  });

  it("reads a league's news newest first, each story once", async () => {
    const soccer = { web: { href: "https://www.espn.com/soccer/story/_/id/1/haaland" } };
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          articles: [
            article({ id: 1, published: "2026-10-24T01:00:00Z", links: soccer }),
            article({ id: 2, published: "2026-10-24T03:00:00Z", links: soccer }),
            article({ id: 1, published: "2026-10-24T01:00:00Z", links: soccer }),
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);
    const stories = await getEspnNews("premier-league");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=24",
      expect.anything()
    );
    expect(stories.map((s) => s.id)).toEqual(["espn-2", "espn-1"]);
  });

  it("is nothing, not a failure, when ESPN does not answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await getEspnNews("nba")).toEqual([]);
  });
});
