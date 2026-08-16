/**
 * YouTube links come in several shapes and users paste whichever one their
 * browser gave them. Rather than demanding one format, we accept them all and
 * derive the video id — which is the only part an embed needs.
 *
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/live/ID
 *
 * Returns null for anything that is not a YouTube URL, which is what the form
 * validates against and what the renderer uses to decide whether to show
 * anything at all.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const id =
    host === "youtu.be"
      ? parsed.pathname.slice(1)
      : host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com"
        ? parsed.pathname === "/watch"
          ? parsed.searchParams.get("v")
          : /^\/(embed|shorts|live|v)\//.test(parsed.pathname)
            ? parsed.pathname.split("/")[2]
            : null
        : null;

  // YouTube ids are 11 characters of [A-Za-z0-9_-]. Checking the shape stops a
  // path fragment or a tracking parameter being embedded as if it were an id.
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Privacy-preserving embed host: no cookie until the viewer hits play. */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export type EmbeddedVideo = {
  provider: "youtube" | "instagram";
  embedUrl: string;
  /** Instagram frames are portrait; YouTube is 16:9. Getting this wrong
   *  letterboxes one or crops the other. */
  aspect: "video" | "portrait";
};

/**
 * Instagram posts and reels share one embed shape, keyed on the short code:
 *
 *   https://www.instagram.com/p/CODE/
 *   https://www.instagram.com/reel/CODE/
 *   https://www.instagram.com/username/reel/CODE/
 */
export function instagramCode(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname.replace(/^www\./, "").toLowerCase() !== "instagram.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  const at = parts.findIndex((p) => p === "p" || p === "reel" || p === "reels" || p === "tv");
  const code = at >= 0 ? parts[at + 1] : null;
  return code && /^[A-Za-z0-9_-]{5,}$/.test(code) ? code : null;
}

/**
 * Resolve any supported video link to something renderable, or null.
 *
 * Null is the useful answer for an unrecognised link: the UI renders nothing
 * rather than an empty frame, so an activity without a video looks like an
 * activity without a video.
 */
export function embeddedVideo(url: string | null | undefined): EmbeddedVideo | null {
  const yt = youtubeVideoId(url);
  if (yt) {
    return {
      provider: "youtube",
      // no-cookie host: nothing is stored on the viewer until they press play.
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
      aspect: "video",
    };
  }

  const ig = instagramCode(url);
  if (ig) {
    return {
      provider: "instagram",
      embedUrl: `https://www.instagram.com/p/${ig}/embed`,
      aspect: "portrait",
    };
  }

  return null;
}
