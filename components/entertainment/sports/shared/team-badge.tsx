import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";

type TeamBadgeProps = {
  team: Pick<Team, "name" | "shortName" | "code" | "primaryColor" | "logoUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-5 w-5 text-2xs",
  md: "h-6 w-6 text-2xs",
  lg: "h-8 w-8 text-xs",
};

/**
 * Black or white, whichever can actually be read on that background.
 *
 * Team colours are whatever the league uses, and some are nearly white — the
 * Spurs' silver rendered as white-on-white. Relative luminance per WCAG; the
 * 0.6 threshold is where white text drops under 4.5:1.
 */
function readableInk(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#111" : "#fff";
}

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  const background = team.primaryColor ?? "#666";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/10",
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: background, color: readableInk(team.primaryColor) }}
      title={team.name}
    >
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        team.code.slice(0, 3)
      )}
    </span>
  );
}
