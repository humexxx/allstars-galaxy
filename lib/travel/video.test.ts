import { describe, expect, it } from "vitest";

import { embeddedVideo, instagramCode, youtubeVideoId } from "./video";

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

const IG = "CxYz123_-ab";

describe("instagramCode", () => {
  it.each([
    [`https://www.instagram.com/p/${IG}/`, "post"],
    [`https://instagram.com/reel/${IG}/`, "reel"],
    [`https://www.instagram.com/someone/reel/${IG}/`, "reel under a profile"],
    [`https://www.instagram.com/p/${IG}/?igsh=abc`, "with tracking"],
  ])("accepts %s (%s)", (url) => {
    expect(instagramCode(url)).toBe(IG);
  });

  it.each([
    ["https://www.instagram.com/someone/", "a profile is not a post"],
    ["https://instagram.com.evil.test/p/" + IG, "lookalike host"],
    ["https://youtube.com/watch?v=" + ID, "another provider"],
  ])("rejects %s (%s)", (url) => {
    expect(instagramCode(url)).toBeNull();
  });
});

describe("embeddedVideo", () => {
  it("embeds YouTube through the no-cookie host, at 16:9", () => {
    // Nothing is set on the viewer until they press play.
    expect(embeddedVideo(`https://youtu.be/${ID}`)).toEqual({
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`,
      aspect: "video",
    });
  });

  it("embeds Instagram portrait — reels are not 16:9", () => {
    expect(embeddedVideo(`https://www.instagram.com/reel/${IG}/`)).toEqual({
      provider: "instagram",
      embedUrl: `https://www.instagram.com/p/${IG}/embed`,
      aspect: "portrait",
    });
  });

  it("returns null when there is nothing to embed", () => {
    // The UI renders nothing for null, so an unsupported link shows no frame
    // rather than a broken one.
    expect(embeddedVideo("https://vimeo.com/123456")).toBeNull();
    expect(embeddedVideo(null)).toBeNull();
  });
});
