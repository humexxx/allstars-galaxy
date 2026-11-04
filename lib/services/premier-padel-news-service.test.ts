import { describe, expect, it } from "vitest";

import { __testing } from "./premier-padel-news-service";

const { storyFrom } = __testing;

// Premier Padel's getNews, one item as it came on 2026-10-25.
const item = (over: Record<string, unknown> = {}) => ({
  id: 545,
  slug: "abud-belluati-se-suben-a-la-ola-de-las-remontadas-para-citarse-con-lebrn-augsburger",
  published_at: "2026-10-25T23:38:25.000Z",
  title: "Abud-Belluati and Axelsson-Ortega’s Comebacks Shake Up Kuwait Major’s Opening Day",
  hero_media_type: "image",
  hero_image_url: "/uploads/hero/original/267c.png",
  hero_media_thumbnail: "/uploads/news/compress/thumbnail/original/2034.png",
  tags: [{ id: 302, tag_name: "KUWAIT MAJOR" }],
  ...over,
});

describe("storyFrom", () => {
  it("maps a story to premierpadel.com, its compressed picture off the CDN", () => {
    expect(storyFrom(item())).toEqual({
      id: "premierpadel-545",
      headline: "Abud-Belluati and Axelsson-Ortega’s Comebacks Shake Up Kuwait Major’s Opening Day",
      description: null,
      href: "https://premierpadel.com/en/news/abud-belluati-se-suben-a-la-ola-de-las-remontadas-para-citarse-con-lebrn-augsburger",
      external: true,
      image: { url: "https://cdn.premierpadel.com/uploads/news/compress/thumbnail/original/2034.png" },
      at: "2026-10-25T23:38:25.000Z",
      kind: "story",
      about: [],
    });
  });

  it("calls a video a video, and leaves out a story with nothing to open or date", () => {
    expect(storyFrom(item({ hero_media_type: "video" }))?.kind).toBe("video");
    expect(storyFrom(item({ slug: undefined }))).toBeNull();
    expect(storyFrom(item({ published_at: undefined }))).toBeNull();
    expect(storyFrom(item({ hero_media_thumbnail: undefined }))?.image).toBeNull();
  });
});
