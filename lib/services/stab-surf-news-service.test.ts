import { describe, expect, it } from "vitest";

import { __testing } from "./stab-surf-news-service";

const { storyFrom } = __testing;

// Stab's WordPress posts with their featured media embedded, trimmed (2026-10-23).
const post = (over: Record<string, unknown> = {}) => ({
  id: 449494,
  date_gmt: "2026-10-23T21:34:34",
  link: "https://stabmag.com/news/griff-makes-history-and-molly-goes-green-to-yellow-at-pumping-supertubos/",
  title: { rendered: "Griff Is The King Of Peniche, Molly Goes Green-To-Yellow At Pumping Supertubos" },
  excerpt: { rendered: "<p>The Rip Curl Pro Portugal ends on the highest note.</p>\n" },
  _embedded: {
    "wp:featuredmedia": [
      {
        source_url: "https://stabmag.com/wp-content/uploads/2026/10/Griffin-scaled.png",
        alt_text: "",
        media_details: { sizes: { medium_large: { source_url: "https://stabmag.com/wp-content/uploads/2026/10/Griffin-768x509.png" } } },
      },
    ],
  },
  ...over,
});

describe("storyFrom", () => {
  it("maps a post: plain text, its 768px picture, its GMT date as one", () => {
    expect(storyFrom(post())).toEqual({
      id: "stab-449494",
      headline: "Griff Is The King Of Peniche, Molly Goes Green-To-Yellow At Pumping Supertubos",
      description: "The Rip Curl Pro Portugal ends on the highest note.",
      href: "https://stabmag.com/news/griff-makes-history-and-molly-goes-green-to-yellow-at-pumping-supertubos/",
      external: true,
      image: { url: "https://stabmag.com/wp-content/uploads/2026/10/Griffin-768x509.png" },
      at: "2026-10-23T21:34:34Z",
      kind: "story",
      about: [],
    });
  });

  it("decodes the title's entities", () => {
    expect(storyFrom(post({ title: { rendered: "Erin&#8217;s Four-Peat Hits A Pickle" } }))?.headline).toBe(
      "Erin’s Four-Peat Hits A Pickle"
    );
  });

  it("leaves out a premium post, behind Stab's paywall", () => {
    expect(storyFrom(post({ link: "https://stabmag.com/premium/a-story/" }))).toBeNull();
  });

  it("falls back to the original picture, and to none", () => {
    expect(storyFrom(post({ _embedded: { "wp:featuredmedia": [{ source_url: "https://x/y.png" }] } }))?.image).toEqual({
      url: "https://x/y.png",
    });
    expect(storyFrom(post({ _embedded: undefined }))?.image).toBeNull();
  });
});
