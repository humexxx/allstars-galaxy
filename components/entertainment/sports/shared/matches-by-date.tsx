"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarX, History, ListFilter } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eyebrow } from "@/components/ui/typography";
import { matchDays, type MatchDay } from "@/lib/sports/match-days";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { ScoreCard } from "./score-card";
import { scrollParent } from "./scroll";
import { SportBarEnd } from "./sport-shell";
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
 * heading in the reader's zone. A team filter, at the end of the sport bar,
 * narrows it to one team's fixtures and results.
 *
 * The page is the only scroller. The list opens on its freshest results
 * rather than scrolling to them, with the days before behind a clock on the
 * first day's heading: a scroll on load never ran on a phone, where the list
 * had no box of its own to scroll.
 *
 * It opens on a day heading, not a label of its own, so that a column beside
 * it which opens on a line like one (`OverviewSplit`'s table) starts its card
 * level with the first match.
 */
export function MatchesByDate({
  matches,
  teams,
  emptyTitle = "No matches available yet",
  className,
}: {
  matches: Match[];
  teams: Map<string, Team>;
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
  const picked = useRef(false);

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

  // The older days go in above the first heading. Bring the newest of them
  // into view and give it focus, so the list reads on upward from where the
  // clock was instead of jumping to the season's first day, and a keyboard is
  // not left on <body> when the button goes.
  useLayoutEffect(() => {
    const day = revealed.current;
    revealed.current = null;
    const target = day ? listRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`) : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "start" });
  }, [showEarlier]);

  // The filter sits in the stuck bar, so a team can be picked deep in the
  // list, which left the new, shorter list starting above the screen. Put
  // its first day back under the bar; a list already in view stays put.
  useLayoutEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    const first = listRef.current?.querySelector<HTMLElement>("[data-day]");
    if (first && hiddenUnderBar(first)) first.scrollIntoView({ block: "start" });
  }, [team]);

  const revealEarlier = (): void => {
    revealed.current = days[earlier - 1]?.day ?? null;
    setShowEarlier(true);
  };

  // Another team opens on its own freshest results, as the list did.
  const pickTeam = (value: string): void => {
    picked.current = true;
    setTeam(value);
    setShowEarlier(false);
  };

  const earlierLabel = `Earlier results, ${earlier} ${earlier === 1 ? "day" : "days"}`;

  const heading = (day: string): string => {
    const name = format.longDay(day);
    if (day === today) return `Today · ${name}`;
    return name;
  };

  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      {options.length > 1 && (
        <SportBarEnd>
          <TeamFilter team={team} options={options} onPick={pickTeam} />
        </SportBarEnd>
      )}
      {days.length === 0 ? (
        <EmptyState icon={CalendarX} title={emptyTitle} />
      ) : (
        <div ref={listRef} className="flex flex-col gap-4">
          {shown.map(({ day, matches: list }, i) => (
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
                  "sticky top-26 z-10 flex items-center justify-between gap-2 bg-background py-1 md:top-12",
                  day === today && "text-foreground"
                )}
              >
                {heading(day)}
                {i === 0 && earlier > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* A 24px target in a 22px line: the negative margins
                          keep the line, and the table's label beside it, as
                          they are. */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="-my-1.5 -mr-1 text-muted-foreground"
                        aria-label={earlierLabel}
                        onClick={revealEarlier}
                      >
                        <History className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{earlierLabel}</TooltipContent>
                  </Tooltip>
                )}
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

/** Whether `day`'s top is up under the sport bar, which its scroll margin clears. */
function hiddenUnderBar(day: HTMLElement): boolean {
  const scrollerTop = scrollParent(day)?.getBoundingClientRect().top ?? 0;
  const margin = Number.parseFloat(getComputedStyle(day).scrollMarginTop) || 0;
  return day.getBoundingClientRect().top < scrollerTop + margin;
}

/**
 * The team filter, quiet in the sport bar: a filter icon or the picked
 * team's crest, with the name and the chevron beside it once the bar has
 * room. On a phone it is the icon alone, so a stuck bar keeps room for the
 * sport's name and its tabs.
 */
function TeamFilter({
  team,
  options,
  onPick,
}: {
  team: string;
  options: Team[];
  onPick: (team: string) => void;
}): React.ReactElement {
  const picked = options.find((t) => t.id === team);
  return (
    <Select value={team} onValueChange={onPick}>
      <SelectTrigger
        size="sm"
        aria-label="Filter by team"
        className={cn(
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground @max-md:px-2 @max-md:[&>svg]:hidden dark:bg-transparent dark:hover:bg-muted/50",
          picked && "text-foreground"
        )}
      >
        <SelectValue>
          {picked ? <TeamBadge team={picked} size="sm" className="size-5" /> : <ListFilter />}
          <span className="sr-only @md:not-sr-only">{picked?.shortName ?? "All teams"}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
        {options.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <TeamBadge team={t} size="sm" className="size-5" />
            {t.shortName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
