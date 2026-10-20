"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarX, ChevronDown, History, ListFilter } from "lucide-react";

import { setSportTeamFilterAction } from "@/app/actions/sports";
import { useReaderTimeZone } from "@/components/reader-time-zone";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eyebrow } from "@/components/ui/typography";
import { runAction } from "@/lib/actions/run";
import { matchDays, type MatchDay } from "@/lib/sports/match-days";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { ScoreCard } from "./score-card";
import { scrollParent } from "./scroll";
import { SportBarEnd } from "./sport-shell";
import { TeamBadge } from "./team-badge";
import { useSavedTeamFilter } from "./team-filter-context";
import { useMatchTime, useSportsToday } from "./time-zone-context";

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
 * narrows it to some teams' fixtures and results. It opens on the teams last
 * picked in this list and remembers a new pick when its menu closes.
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
  const saved = useSavedTeamFilter();
  const [picks, setPicks] = useState<readonly string[]>(() => saved?.teamIds ?? []);
  const [showEarlier, setShowEarlier] = useState(false);
  const [, startSaving] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const revealed = useRef<string | null>(null);
  const narrowed = useRef(false);

  const options = useMemo(() => {
    const ids = new Set(matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]));
    return [...ids]
      .map((id) => teams.get(id))
      .filter((t): t is Team => Boolean(t))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [matches, teams]);

  // A remembered team that has left the list (relegated, knocked out) is
  // let go rather than leaving the list empty.
  const picked = useMemo(() => {
    const present = new Set(options.map((t) => t.id));
    return picks.filter((id) => present.has(id));
  }, [options, picks]);

  const days = useMemo(
    () => matchDays(matches, timeZone, new Set(picked)),
    [matches, picked, timeZone]
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
    if (!narrowed.current) return;
    narrowed.current = false;
    const first = listRef.current?.querySelector<HTMLElement>("[data-day]");
    if (first && hiddenUnderBar(first)) first.scrollIntoView({ block: "start" });
  }, [picks]);

  const revealEarlier = (): void => {
    revealed.current = days[earlier - 1]?.day ?? null;
    setShowEarlier(true);
  };

  // Other teams open on their own freshest results, as the list did.
  const pickTeams = (next: readonly string[]): void => {
    narrowed.current = true;
    setPicks(next);
    setShowEarlier(false);
  };

  const saveTeams = (teamIds: readonly string[]): void => {
    if (!saved) return;
    startSaving(async () => {
      await runAction(setSportTeamFilterAction({ ...saved.list, teamIds: [...teamIds] }), {
        failure: "Couldn't save your teams",
      });
    });
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
          <TeamFilter options={options} picked={picked} onPick={pickTeams} onSave={saveTeams} />
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
 * The team filter, quiet in the sport bar: a filter icon or the picked teams'
 * crests, with what is picked and a chevron beside it once the bar has room.
 * On a phone it is the icons alone, so a stuck bar keeps room for the sport's
 * name and its tabs.
 *
 * The menu picks several teams, with a search for a twenty- or thirty-six-team
 * league. The list behind it follows each tick; the pick is saved once, when
 * the menu closes having changed.
 */
function TeamFilter({
  options,
  picked,
  onPick,
  onSave,
}: {
  options: Team[];
  picked: readonly string[];
  onPick: (teamIds: readonly string[]) => void;
  onSave: (teamIds: readonly string[]) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const atOpen = useRef("");
  const chosen = new Set(picked);
  const crests = picked
    .map((id) => options.find((t) => t.id === id))
    .filter((t): t is Team => Boolean(t));
  const label =
    crests.length === 0
      ? "All teams"
      : crests.length === 1
        ? crests[0].shortName
        : `${crests.length} teams`;

  const sameAs = (ids: readonly string[]): string => [...ids].sort().join(",");
  const openChange = (next: boolean): void => {
    if (next) atOpen.current = sameAs(picked);
    else if (sameAs(picked) !== atOpen.current) onSave(picked);
    setOpen(next);
  };
  const toggle = (id: string): void =>
    onPick(chosen.has(id) ? picked.filter((p) => p !== id) : [...picked, id]);

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Filter by team: ${label}`}
          className={cn(
            "text-muted-foreground @max-md:px-2",
            crests.length > 0 && "text-foreground"
          )}
        >
          {crests.length === 0 ? (
            <ListFilter data-icon="inline-start" />
          ) : (
            <span className="flex -space-x-1.5">
              {crests.slice(0, 3).map((t) => (
                <TeamBadge key={t.id} team={t} size="sm" className="size-5 ring-2 ring-background" />
              ))}
            </span>
          )}
          <span className="sr-only @md:not-sr-only">{label}</span>
          <ChevronDown data-icon="inline-end" className="@max-md:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command label="Search teams">
          <CommandInput placeholder="Search teams…" />
          <CommandList label="Teams" aria-multiselectable>
            <CommandEmpty>No team found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All teams"
                data-checked={crests.length === 0}
                aria-checked={crests.length === 0}
                onSelect={() => onPick([])}
              >
                <ListFilter />
                All teams
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.id}
                  keywords={[t.shortName, t.name, t.code]}
                  data-checked={chosen.has(t.id)}
                  aria-checked={chosen.has(t.id)}
                  onSelect={() => toggle(t.id)}
                >
                  <TeamBadge team={t} size="sm" className="size-5" />
                  {t.shortName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
