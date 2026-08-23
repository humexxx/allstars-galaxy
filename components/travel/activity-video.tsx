import { embeddedVideo } from "@/lib/travel/video";

/**
 * An activity's video, when there is one.
 *
 * Renders nothing at all for a missing or unrecognised link rather than an
 * empty frame or a broken-player box: an activity without a video should look
 * like an activity without a video.
 *
 * YouTube goes through youtube-nocookie.com so nothing is stored on the viewer
 * until they press play — trips are also served publicly through a share
 * token, where the visitor has agreed to nothing.
 */
export function ActivityVideo({
  url,
  title,
}: {
  url: string | null | undefined;
  title: string;
}) {
  const video = embeddedVideo(url);
  if (!video) return null;

  return (
    <div
      className={
        video.aspect === "portrait"
          ? "mx-auto w-full max-w-sm overflow-hidden rounded-xl border bg-muted"
          : "overflow-hidden rounded-xl border bg-muted"
      }
    >
      {/* Instagram frames are portrait and YouTube is 16:9; forcing one ratio
          on both letterboxes one and crops the other. */}
      <iframe
        src={video.embedUrl}
        title={`${title} — video`}
        className={video.aspect === "portrait" ? "aspect-[9/14] w-full" : "aspect-video w-full"}
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
