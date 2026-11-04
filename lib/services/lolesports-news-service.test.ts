import { describe, expect, it } from "vitest";

import { __testing } from "./lolesports-news-service";

const { articlesIn, storyFrom } = __testing;

/** One `Article` as lolesports.com's news page inlines it, inside a React payload string. */
const article = {
  __typename: "Article",
  _id: "e59b54b4.en-us",
  externalTitle: "Worlds 2026 Primer",
  description: "Everything to know before the Swiss stage.",
  externalUrl: null,
  path: { __typename: "Slug", current: "/news/worlds-2026-primer" },
  publishingDates: { __typename: "PublishingDates", displayedPublishDate: "2026-10-05T15:00:00.000Z" },
  bannerMedia: {
    __typename: "MultimediaAsset",
    sanityImage: { __typename: "Image", asset: { __typename: "SanityImageAsset", url: "https://cdn.sanity.io/images/x/news_live/a-1920x1080.jpg" } },
  },
};

const page = (payload: string): string =>
  `<html><body><script>self.__next_f.push([1,${JSON.stringify(payload)}])</script></body></html>`;

describe("articlesIn", () => {
  it("reads each article out of the page's React payload, once", () => {
    const payload = `3:["$","div",null,{"children":[{"article":${JSON.stringify(article)}},{"article":${JSON.stringify(article)}}]}]`;
    const found = articlesIn(page(payload));
    expect(found).toHaveLength(1);
    expect(found[0].externalTitle).toBe("Worlds 2026 Primer");
  });

  it("finds nothing in a page with no payload", () => {
    expect(articlesIn("<html></html>")).toEqual([]);
  });
});

describe("storyFrom", () => {
  it("maps an article to its lolesports.com page, a 768px banner", () => {
    expect(storyFrom(article)).toEqual({
      id: "lolesports-e59b54b4.en-us",
      headline: "Worlds 2026 Primer",
      description: "Everything to know before the Swiss stage.",
      href: "https://lolesports.com/en-US/news/worlds-2026-primer",
      external: true,
      image: { url: "https://cdn.sanity.io/images/x/news_live/a-1920x1080.jpg?w=768&auto=format" },
      at: "2026-10-05T15:00:00.000Z",
      kind: "story",
      about: [],
    });
  });

  it("calls a YouTube link a video, and leaves out one with no date", () => {
    expect(storyFrom({ ...article, externalUrl: "https://www.youtube.com/watch?v=x" })?.kind).toBe("video");
    expect(storyFrom({ ...article, publishingDates: null })).toBeNull();
  });
});
