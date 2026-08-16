import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl, youtubeVideoId } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("youtubeVideoId", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, "watch"],
    [`https://youtube.com/watch?v=${ID}&t=42s`, "watch with params"],
    [`https://youtu.be/${ID}`, "short link"],
    [`https://youtu.be/${ID}?si=abc`, "short link with tracking"],
    [`https://www.youtube.com/embed/${ID}`, "embed"],
    [`https://www.youtube.com/shorts/${ID}`, "shorts"],
    [`https://www.youtube.com/live/${ID}`, "live"],
    [`https://m.youtube.com/watch?v=${ID}`, "mobile"],
    [`  https://youtu.be/${ID}  `, "padded with spaces"],
  ])("accepts %s (%s)", (url) => {
    expect(youtubeVideoId(url)).toBe(ID);
  });

  it.each([
    ["", "empty"],
    [null, "null"],
    ["not a url", "not a url"],
    ["https://vimeo.com/123456", "another host"],
    ["https://www.youtube.com/", "no video"],
    ["https://www.youtube.com/watch?v=tooshort", "malformed id"],
    ["https://youtube.com.evil.test/watch?v=" + ID, "lookalike host"],
    ["javascript:alert(1)//youtube.com", "non-http scheme"],
  ] as [string | null, string][])("rejects %s (%s)", (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });

  it("does not treat a channel path as a video", () => {
    expect(youtubeVideoId("https://www.youtube.com/@someone")).toBeNull();
  });
});

describe("youtubeEmbedUrl", () => {
  it("embeds through the no-cookie host", () => {
    // Nothing is set on the viewer until they press play.
    expect(youtubeEmbedUrl(`https://youtu.be/${ID}`)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}`
    );
  });

  it("returns null when there is nothing to embed", () => {
    expect(youtubeEmbedUrl("https://example.com")).toBeNull();
  });
});
