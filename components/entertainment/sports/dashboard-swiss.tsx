import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DashboardSwiss as DashboardSwissData } from "@/types/sports";

import { TeamBadge } from "./shared/team-badge";

/**
 * A LoL card's Swiss stage at a glance, where another sport has its table:
 * one row a record, its teams as crests, striped like the tables' rows so the
 * two read alike side by side. The crests are named for screen readers.
 */
export function DashboardSwiss({ swiss }: { swiss: DashboardSwissData }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow size="sm" asChild>
        <h3>Swiss stage</h3>
      </Eyebrow>
      <ul role="list" className="flex flex-col gap-1">
        {swiss.pools.map((pool) => (
          <li key={pool.label} className="flex items-center gap-2 rounded-md px-1.5 py-1 odd:bg-muted/40">
            <Mono
              className={cn(
                "w-14 shrink-0 text-2xs",
                pool.outcome === "through" && "text-success",
                pool.outcome === "out" && "text-muted-foreground"
              )}
            >
              {pool.label}
            </Mono>
            <ul role="list" aria-label={pool.label} className="flex min-w-0 flex-1 flex-wrap gap-1">
              {pool.teams.map((team) => (
                <li key={team.name} className={cn(pool.outcome === "out" && "opacity-50")}>
                  <TeamBadge
                    team={{
                      name: team.name,
                      shortName: team.name,
                      code: team.code ?? team.name.slice(0, 3),
                      primaryColor: team.color,
                      logoUrl: team.image?.url,
                    }}
                    size="sm"
                  />
                  <span className="sr-only">{team.name}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
