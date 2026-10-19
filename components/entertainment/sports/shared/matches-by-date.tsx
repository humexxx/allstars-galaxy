"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarX, ChevronUp } from "lucide-react";

import { useReaderTimeZone } from "@/components/reader-time-zone";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eyebrow } from "@/components/ui/typography";
import { matchDays, type MatchDay } from "@/lib/sports/match-days";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { ScoreCard } from "./score-card";
import { TeamBadge } from "./team-badge";
import { useMatchTime, useSportsToday } from "./time-zone-context";

const ALL_TEAMS = "all";

const FINISHED: ReadonlySet<MatchStatus> = new Set<MatchStatus>(["ft", "aet", "pen"]);

/**
 * Where the list opens: the latest day up to today with a result in it, so
 * the freshest results lead and what is next follows. A season with no
 * result yet opens on its first day.
 */
export function openingDayIndex(days: MatchDay[], today: string): number {
  for (let i = days.length - 1; i >= 0; i--) {
    const { day, matches } = days[i];
    if (day <= today && matches.some((m) => FINISHED.has(m.status))) return i;
  }
  return 0;
}

/**
 * Every match, one day at a time: oldest first, each day under its own
 * heading in the reader's zone. A team filter narrows it to one team's
 * fixtures and results.
 *
 * The page is the only scroller. The list opens on its freshest results
 * rather than scrolling to them, with the days before behind "Earlier
 * results": a scroll on load never ran on a phone, where the list had no
 * box of its own to scroll.
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
}): React.ReactElement {
  const timeZone = useReaderTimeZone();
  const format = useMatchTime();
  const today = useSportsToday();
  const [team, setTeam] = useState(ALL_TEAMS);
  const [showEarlier, setShowEarlier] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const revealed = useRef<string | null>(null);

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

  const earlier = showEarlier ? 0 : openingDayIndex(days, today);
  const shown = days.slice(earlier);

  // The older days go in above the button. Bring the newest of them into view
  // and give it focus, so the list reads on upward from where the button was
  // instead of jumping to the season's first day, and a keyboard is not left
  // on <body> when the button goes.
  useLayoutEffect(() => {
    const day = revealed.current;
    revealed.current = null;
    const target = day ? listRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`) : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
  }, [showEarlier]);

  const revealEarlier = (): void => {
    revealed.current = days[earlier - 1]?.day ?? null;
    setShowEarlier(true);
  };

  // Another team opens on its own freshest results, as the list did.
  const pickTeam = (value: string): void => {
    setTeam(value);
    setShowEarlier(false);
  };

  const heading = (day: string): string => {
    const name = format.longDay(day);
    if (day === today) return `Today · ${name}`;
    return name;
  };

  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
        <Eyebrow>{label}</Eyebrow>
        {options.length > 1 && (
          <Select value={team} onValueChange={pickTeam}>
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
        <div ref={listRef} className="flex flex-col gap-4">
          {earlier > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 self-start text-muted-foreground"
              onClick={revealEarlier}
            >
              <ChevronUp />
              Earlier results ({earlier} {earlier === 1 ? "day" : "days"})
            </Button>
          )}
          {shown.map(({ day, matches: list }) => (
            // The scroll margin and the heading's offset clear the sport bar
            // (and on a phone the app header above it): SPACING.md.
            <div
              key={day}
              data-day={day}
              tabIndex={-1}
              className="flex scroll-mt-26 flex-col gap-2 outline-none md:scroll-mt-12"
            >
              <Eyebrow
                size="sm"
                as="div"
                className={cn(
                  "sticky top-26 z-10 bg-background py-1 md:top-12",
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
