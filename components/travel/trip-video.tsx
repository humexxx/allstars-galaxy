import { youtubeEmbedUrl } from "@/lib/travel/youtube";

/**
 * The trip's video, when there is one.
 *
 * Renders nothing at all for a missing or unrecognised link rather than an
 * empty frame or a broken-player box: a trip without a video should look like
 * a trip without a video.
 *
 * The iframe points at youtube-nocookie.com, so nothing is stored on the
 * viewer until they actually press play — this page is also served publicly
 * through a share token, where a visitor has agreed to nothing.
 */
export function TripVideo({
  url,
  title,
}: {
  url: string | null | undefined;
  title: string;
}) {
  const embed = youtubeEmbedUrl(url);
  if (!embed) return null;

  return (
    <div className="overflow-hidden rounded-xl border bg-muted">
      {/* aspect-video keeps the frame at 16:9 at every width; a fixed height
          letterboxes on mobile and crops on desktop. */}
      <iframe
        src={embed}
        title={`${title} — video`}
        className="aspect-video w-full"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        // Third-party frame: allow it to play and go fullscreen, nothing else.
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
