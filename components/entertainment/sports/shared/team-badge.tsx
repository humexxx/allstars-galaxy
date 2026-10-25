import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";

type TeamBadgeProps = {
  team: Pick<Team, "name" | "shortName" | "code" | "primaryColor" | "logoUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
};

// A three-letter code ("BOD", "RMA") at the 10px floor is ~19px of ink: in
// the old 20px disc it ran edge to edge and the curve clipped the outer
// letters. 24px is the smallest disc that holds one with air around it.
const sizeMap = {
  sm: "size-6 text-2xs tracking-tighter",
  md: "size-7 text-2xs tracking-tighter",
  lg: "size-9 text-xs tracking-tight",
};

/**
 * A logo sits inset in its disc, not edge to edge. Logos are drawn on a
 * square: a wordmark (the Lakers) or a wide crest (the Pelicans) reaches the
 * square's sides, and the disc's curve sliced them off. Inset, every one
 * shows whole and centred, the club colour a ring around it.
 */
const logoInset = {
  sm: "p-0.5",
  md: "p-1",
  lg: "p-1.5",
};

/** The relative luminance of the dark ink, #111. */
const DARK_INK_LUMINANCE = 0.0056;

/**
 * Black or white, whichever contrasts more with that background.
 *
 * Team colours are whatever the league uses, and some are nearly white — the
 * Spurs' silver rendered as white-on-white. Relative luminance and contrast
 * per WCAG. White drops under 4.5:1 once the background passes a luminance of
 * about 0.18, so mid-light colours (Real Madrid's gold, City's sky blue) take
 * the dark ink too.
 */
export function readableInk(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / (DARK_INK_LUMINANCE + 0.05);
  return whiteContrast >= darkContrast ? "#fff" : "#111";
}

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  const background = team.primaryColor ?? "#666";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold leading-none ring-1 ring-black/10",
        sizeMap[size],
        team.logoUrl && logoInset[size],
        className,
      )}
      style={{ backgroundColor: background, color: readableInk(team.primaryColor) }}
      title={team.name}
    >
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="size-full object-contain" />
      ) : (
        team.code.slice(0, 3)
      )}
    </span>
  );
}
