/**
 * Thin wrapper around microlink.io's free screenshot API. We use it so
 * the More Apps page can render real previews of sibling projects
 * without us having to integrate provider-specific screenshot endpoints
 * (Vercel's, Firebase doesn't have one, etc.).
 *
 * Free tier limit: 50 requests/day, anonymous. We rely on Next.js's
 * fetch cache (revalidate 24h) so each app URL only hits microlink
 * once per day — well under the limit for personal use.
 *
 * Returns null on any failure so the caller can fall back to a
 * gradient placeholder.
 */
export async function getScreenshotUrl(
  targetUrl: string
): Promise<string | null> {
  try {
    const apiUrl = new URL("https://api.microlink.io/");
    apiUrl.searchParams.set("url", targetUrl);
    apiUrl.searchParams.set("screenshot", "true");
    apiUrl.searchParams.set("meta", "false");

    const res = await fetch(apiUrl.toString(), {
      next: { revalidate: 86_400 }, // 24h
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: { screenshot?: { url?: string } };
    };
    return json?.data?.screenshot?.url ?? null;
  } catch {
    return null;
  }
}
