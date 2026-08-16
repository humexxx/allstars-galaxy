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
