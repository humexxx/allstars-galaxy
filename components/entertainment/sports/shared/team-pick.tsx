"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";

import { usePickTeam } from "./team-filter-context";

/**
 * A team's badge and name where a tap on them narrows the view's match list
 * to its fixtures (a table row, a match card): a toggle with its own hover,
 * pressed while the list shows that team alone. Where nothing on the view
 * would follow it, or the list has none of the team's games, the same
 * content, inert.
 */
export function TeamPick({
  team,
  className,
  children,
}: {
  team: Team;
  className?: string;
  children: ReactNode;
}): React.ReactElement {
  const picker = usePickTeam();
  const layout = cn("flex min-w-0 items-center gap-2", className);
  if (!picker || !picker.can(team.id)) return <span className={layout}>{children}</span>;
  // Named by what it shows (the club's code in a narrow table), so a voice
  // user can say what they see; what a tap does is its description.
  return (
    <button
      type="button"
      aria-pressed={picker.only(team.id)}
      aria-describedby={picker.hintId}
      onClick={() => picker.pick(team.id)}
      className={cn(
        layout,
        "-mx-2 -my-1 cursor-pointer rounded-md px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden aria-pressed:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
