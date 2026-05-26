import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /**
   * When true (default), renders the full rounded badge: filled background
   * tile with the star and streak inverted on top. When false, renders only
   * the star + streak (no badge) so it can sit inline in a header that
   * already has its own background — same shape as the favicon, no wrapper.
   */
  withBadge?: boolean;
  "aria-label"?: string;
};

/**
 * Allstars Galaxy mark: a 4-point shooting star streaking across a rounded
 * square badge. Mirrors `public/favicon-{light,dark}.svg` byte-for-byte
 * (same coords, same opacities) so the in-app logo and the browser tab icon
 * stay visually identical when the theme flips.
 *
 * Colours are theme-aware via `currentColor` + `bg-foreground` /
 * `text-background` — the badge tile uses the page foreground colour and
 * the star/streak punch through with the background colour, so a single
 * source paints correctly in both light and dark mode without an explicit
 * theme prop.
 */
export function Logo({
  className,
  withBadge = true,
  "aria-label": ariaLabel = "Allstars Galaxy",
}: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "shrink-0",
        withBadge ? "text-background" : "text-foreground",
        className
      )}
    >
      {withBadge && (
        <rect
          width="32"
          height="32"
          rx="7"
          className="fill-foreground"
        />
      )}
      <g
        stroke="currentColor"
        strokeLinecap="round"
        fill="none"
      >
        <line x1="6" y1="26" x2="10" y2="22" strokeWidth="1.4" opacity="0.35" />
        <line x1="9" y1="23" x2="14" y2="18" strokeWidth="1.7" opacity="0.55" />
        <line x1="13" y1="19" x2="18" y2="14" strokeWidth="2" opacity="0.85" />
      </g>
      <path
        fill="currentColor"
        d="M22 5 L23.2 10 L28 11.2 L23.2 12.4 L22 17 L20.8 12.4 L16 11.2 L20.8 10 Z"
      />
    </svg>
  );
}
