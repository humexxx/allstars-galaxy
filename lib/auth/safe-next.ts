/**
 * The `?next=` path a sign-in may return to — a path on THIS site or nothing.
 *
 * "Starts with / but not //" is not enough: URL parsers treat a backslash as
 * a slash and drop tabs and newlines, so `/\evil.com` and `/<tab>/evil.com`
 * both resolve to https://evil.com. Anything with a backslash or a control
 * character is refused outright, and what is left must still resolve to the
 * same origin it started from.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  const base = "http://same-origin.invalid";
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.origin !== base) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
