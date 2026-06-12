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

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/10",
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: team.primaryColor ?? "#666" }}
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
