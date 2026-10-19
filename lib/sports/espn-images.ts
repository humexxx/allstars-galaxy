const ESPN_CDN = "https://a.espncdn.com";
/** Three times a 32px disc, so a badge stays sharp on a phone's screen. */
const DEFAULT_SIZE = 96;

/**
 * An ESPN CDN image at the size it is drawn, through ESPN's own resizer.
 *
 * The originals are far bigger than any badge here: a tennis or racing
 * headshot is 600×436 and about 230 KB, an NFL scoreboard logo 4096² and up to
 * 570 KB — each drawn in a disc under 40px. A table of twenty-two drivers was
 * five megabytes of faces. `/combiner/i` is the resizer espn.com itself serves
 * its images through; it returns the same picture cropped square at the size
 * asked for, about 15 KB for a headshot, and a 404 wherever the original is
 * missing, exactly as the original path does.
 *
 * Not `next/image`'s optimizer: that would need ESPN's host allowlisted and
 * would spend optimizer quota on images ESPN already resizes for free.
 *
 * Anything that is not an ESPN CDN image passes through untouched.
 */
export function espnImage(src: string | undefined, size = DEFAULT_SIZE): string | undefined {
  if (!src) return undefined;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return undefined;
  }
  if (url.origin !== ESPN_CDN || !url.pathname.startsWith("/i/")) return src;
  return `${ESPN_CDN}/combiner/i?img=${url.pathname}&w=${size}&h=${size}&scale=crop`;
}
