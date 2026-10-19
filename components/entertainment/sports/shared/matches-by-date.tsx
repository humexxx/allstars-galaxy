"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarX } from "lucide-react";

import { useReaderTimeZone } from "@/components/reader-time-zone";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eyebrow } from "@/components/ui/typography";
import { matchDays } from "@/lib/sports/match-days";
import { cn } from "@/lib/utils";
import type { Match, Team } from "@/types/sports";

import { ScoreCard } from "./score-card";
import { TeamBadge } from "./team-badge";
import { useMatchTime, useSportsToday } from "./time-zone-context";

const ALL_TEAMS = "all";

/**
 * Every match, one day at a time: oldest first, each day under its own
 * heading in the reader's zone, opening on today. A team filter narrows it to
 * one team's fixtures and results.
 *
 * Once the table sits beside it (`@4xl`, the views' split) the list scrolls on
 * its own, so the table stays put. Narrower, the table is below the list and
 * the page is the scroller (see SPACING.md): a box that stopped the wheel at
 * its end would keep the reader from reaching it.
 */
export function MatchesByDate({
  matches,
  teams,
  label = "Matches",
  emptyTitle = "No matches available yet",
  className,
}: {
  matches: Match[];
  teams: Map<string, Team>;
  label?: string;
  emptyTitle?: string;
  className?: string;
}) {
  const timeZone = useReaderTimeZone();
  const format = useMatchTime();
  const [team, setTeam] = useState(ALL_TEAMS);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    const ids = new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    return [...ids]
      .map((id) => teams.get(id))
      .filter((t): t is Team => Boolean(t))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [matches, teams]);

  const days = useMemo(
    () => matchDays(matches, timeZone, team === ALL_TEAMS ? null : team),
    [matches, team, timeZone]
  );

  const today = useSportsToday();
  const opening = days.find((d) => d.day >= today)?.day ?? days.at(-1)?.day;

  // Open on today rather than on the oldest result: what is next is what the
  // reader came for, and the results are a scroll up away.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight || !opening) return;
    const target = scroller.querySelector<HTMLElement>(`[data-day="${opening}"]`);
    scroller.scrollTop = target ? target.offsetTop : 0;
  }, [opening, team]);

  const heading = (day: string): string => {
    const name = format.longDay(day);
    if (day === today) return `Today · ${name}`;
    return name;
  };

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {options.length > 1 && (
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger size="sm" className="w-48" aria-label="Filter by team">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
              {options.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <TeamBadge team={t} size="sm" className="size-5" />
                  {t.shortName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {days.length === 0 ? (
        <EmptyState icon={CalendarX} title={emptyTitle} />
      ) : (
        <div
          ref={scrollerRef}
          // Focusable so a keyboard can scroll it too: nothing inside is.
          tabIndex={0}
          role="region"
          aria-label={label}
          className="relative flex flex-col gap-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 @4xl:max-h-160 @4xl:overflow-y-auto @4xl:overscroll-contain @4xl:pr-1"
        >
          {days.map(({ day, matches: list }) => (
            <div key={day} data-day={day} className="flex flex-col gap-2">
              <Eyebrow
                size="sm"
                as="div"
                className={cn(
                  "@4xl:sticky @4xl:top-0 @4xl:z-10 @4xl:bg-background @4xl:py-1",
                  day === today && "text-foreground"
                )}
              >
                {heading(day)}
              </Eyebrow>
              <div className="grid gap-2 @xl:grid-cols-2">
                {list.map((match) => (
                  <ScoreCard key={match.id} match={match} teams={teams} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
