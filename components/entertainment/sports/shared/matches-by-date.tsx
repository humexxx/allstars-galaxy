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
} from "@/components/ui/command";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eyebrow } from "@/components/ui/typography";
import { runAction } from "@/lib/actions/run";
import { matchDays, type MatchDay } from "@/lib/sports/match-days";
import { cn } from "@/lib/utils";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { EASE, fadeIn, holdScrollStill, holdStill, SLIDE_MS } from "./reveal";
import { RevealPill } from "./reveal-pill";
import { ScoreCard } from "./score-card";
import { scrollParent } from "./scroll";
import { TeamBadge } from "./team-badge";
import { useSavedTeamFilter } from "./team-filter-context";
import { rememberTeams } from "../seen-sports";
import { useMatchTime, useSportsToday } from "./time-zone-context";

const FINISHED: ReadonlySet<MatchStatus> = new Set<MatchStatus>(["ft", "aet", "pen"]);

/** Days one tap of the clock brings in: a matchday, a week of the NFL, three NBA nights. */
const EARLIER_STEP = 3;

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
 * had no box of its own to scroll. Each tap brings in a few more days above
 * without moving the page: the days on screen slide down to make room, the
 * new ones fade in where the reader is looking, and the clock stays on top
 * for the next few.
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
  // The filter's menu is the list's, not its pill's: the pill rides the first
  // day's heading, and a tick that changes which day comes first moves it to
  // another heading, while the menu stays open as it was, search and all.
  const [filterOpen, setFilterOpen] = useState(false);
  const pickedAtOpen = useRef("");
  // How many days before the opening one are shown.
  const [extra, setExtra] = useState(0);
  const [, startSaving] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const reveal = useRef<{ tops: Map<string, number>; added: string[] } | null>(null);
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

  const filtering = options.length > 1;
  const crests = picked
    .map((id) => options.find((t) => t.id === id))
    .filter((t): t is Team => Boolean(t));

  const earlier = Math.max(0, openingDayIndex(days, today) - extra);
  const shown = days.slice(earlier);
  const step = Math.min(EARLIER_STEP, earlier);

  // The new days are in, above the ones that were shown, and the page has
  // not scrolled. The focus goes to the clock on the new first heading, for
  // the next few days, or to that heading's day once there are none.
  useLayoutEffect(() => {
    const done = reveal.current;
    const list = listRef.current;
    reveal.current = null;
    if (!done || !list) return;
    const clock = list.querySelector<HTMLElement>("[data-earlier]");
    (clock ?? list.querySelector<HTMLElement>("[data-day]"))?.focus({ preventScroll: true });
    slideIn(list, done.tops, done.added);
  }, [extra]);

  // The filter rides the first day's heading, stuck under the bar while that
  // day is read, so a pick can leave the new, shorter list starting above the
  // screen. Put its first day back under the bar; a list already in view
  // stays put.
  useLayoutEffect(() => {
    if (!narrowed.current) return;
    narrowed.current = false;
    const first = listRef.current?.querySelector<HTMLElement>("[data-day]");
    if (first && hiddenUnderBar(first)) first.scrollIntoView({ block: "start" });
  }, [picks]);

  const revealEarlier = (): void => {
    const list = listRef.current;
    if (!list || step === 0) return;
    const tops = new Map<string, number>();
    for (const el of list.querySelectorAll<HTMLElement>("[data-day]")) {
      tops.set(el.dataset.day ?? "", el.getBoundingClientRect().top);
    }
    holdScrollStill(list);
    reveal.current = { tops, added: days.slice(earlier - step, earlier).map((d) => d.day) };
    setExtra(extra + step);
  };

  // Other teams open on their own freshest results, as the list did.
  const pickTeams = (next: readonly string[]): void => {
    narrowed.current = true;
    setPicks(next);
    setExtra(0);
  };

  // Saved once, when the menu closes having changed: a run of ticks is one write.
  const openFilter = (open: boolean): void => {
    if (open) pickedAtOpen.current = sameTeams(picked);
    else if (sameTeams(picked) !== pickedAtOpen.current) saveTeams(picked);
    setFilterOpen(open);
  };

  const saveTeams = (teamIds: readonly string[]): void => {
    if (!saved) return;
    startSaving(async () => {
      const result = await runAction(
        setSportTeamFilterAction({ ...saved.list, teamIds: [...teamIds] }),
        { failure: "Couldn't save your teams" }
      );
      if (result.ok) rememberTeams(saved.list, teamIds);
    });
  };

  // What a tap brings in, by its dates: "Show Oct 10 – Oct 14", or one day.
  const batch = days.slice(earlier - step, earlier);
  const earlierDates =
    batch.length > 1
      ? `${format.shortDay(batch[0].day)} – ${format.shortDay(batch[batch.length - 1].day)}`
      : batch[0]
        ? format.shortDay(batch[0].day)
        : "";
  const earlierLabel = `Show ${earlierDates}`;

  const heading = (day: string): string => {
    const name = format.longDay(day);
    if (day === today) return `Today · ${name}`;
    return name;
  };

  return (
    // Its own container, so the columns follow the list's width: beside a
    // table it is two-thirds of the row, alone it is all of it.
    <section className={cn("@container flex min-w-0 flex-col", className)}>
      {days.length === 0 ? (
        <EmptyState icon={CalendarX} title={emptyTitle} />
      ) : (
        <Popover open={filterOpen} onOpenChange={openFilter}>
          <div ref={listRef} className="flex flex-col gap-4">
            {shown.map(({ day, matches: list }, i) => (
              // The heading's offset clears the sport bar (and on a phone the
              // app header above it), as the scroller's scroll padding does
              // for a day scrolled to: SPACING.md.
              <div key={day} data-day={day} tabIndex={-1} className="flex flex-col gap-2 outline-none">
                <Eyebrow
                  size="sm"
                  as="div"
                  className={cn(
                    "sticky top-26 z-10 flex items-center justify-between gap-2 bg-background py-1 md:top-12",
                    day === today && "text-foreground"
                  )}
                >
                  {/* The day alone: the controls beside it stay out of its name. */}
                  <h2 className="min-w-0">{heading(day)}</h2>
                  {/* On the first day's line: the teams, then the days before. */}
                  {i === 0 && (filtering || earlier > 0) && (
                    <span className="flex items-center gap-1.5">
                      {filtering && <TeamFilterPill crests={crests} />}
                      {earlier > 0 && (
                        <RevealPill
                          icon={History}
                          label="Earlier"
                          detail={earlierLabel}
                          data-earlier
                          onClick={revealEarlier}
                        />
                      )}
                    </span>
                  )}
                </Eyebrow>
                <ul role="list" className="grid gap-2 @xl:grid-cols-2 @5xl:grid-cols-3">
                  {list.map((match) => (
                    <ScoreCard key={match.id} as="li" match={match} teams={teams} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {filtering && <TeamFilterMenu options={options} picked={picked} onPick={pickTeams} />}
        </Popover>
      )}
    </section>
  );
}

/** A pick as a key that ignores the order the teams were ticked in. */
function sameTeams(ids: readonly string[]): string {
  return [...ids].sort().join(",");
}

/**
 * The days that were on screen slide from where they were to where they are
 * now (down, by the height of the days added), and the added days fade in
 * after them. Nothing moves for a reader who asked for less motion, or where
 * there is no Web Animations API (a test).
 */
function slideIn(list: HTMLElement, tops: Map<string, number>, added: string[]): void {
  if (holdStill(list)) return;
  for (const el of list.querySelectorAll<HTMLElement>("[data-day]")) {
    const day = el.dataset.day ?? "";
    const was = tops.get(day);
    if (was !== undefined) {
      const by = was - el.getBoundingClientRect().top;
      if (by !== 0) {
        el.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], {
          duration: SLIDE_MS,
          easing: EASE,
        });
      }
    } else if (added.includes(day)) {
      fadeIn(el, SLIDE_MS / 2);
    }
  }
}

/** Whether `day`'s top is up under the sport bar, which the scroller's scroll padding clears. */
function hiddenUnderBar(day: HTMLElement): boolean {
  const scroller = scrollParent(day);
  const margin = Number.parseFloat(getComputedStyle(day).scrollMarginTop) || 0;
  return day.getBoundingClientRect().top < (scroller?.getBoundingClientRect().top ?? 0) + margin;
}

/**
 * The team filter's pill, on the first day's heading line beside "Earlier",
 * set as that one is: a filter icon or the picked teams' crests, with what is
 * picked and a chevron once the list has room; on a phone the icons alone,
 * so the line keeps room for the day. Its name says which teams the crests
 * are.
 */
function TeamFilterPill({ crests }: { crests: Team[] }): React.ReactElement {
  const label =
    crests.length === 0
      ? "All teams"
      : crests.length === 1
        ? crests[0].shortName
        : `${crests.length} teams`;
  const names = crests.length > 1 ? ` (${crests.map((t) => t.shortName).join(", ")})` : "";

  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="xs"
        aria-label={`Filter by team: ${label}${names}`}
        className="-my-1.5 rounded-full font-medium tracking-normal normal-case"
      >
        {crests.length === 0 ? (
          <ListFilter data-icon="inline-start" />
        ) : (
          <span className="flex -space-x-1.5">
            {crests.slice(0, 3).map((t) => (
              <TeamBadge key={t.id} team={t} size="sm" className="size-4 ring-2 ring-background" />
            ))}
          </span>
        )}
        <span className="sr-only @md:not-sr-only">{label}</span>
        <ChevronDown data-icon="inline-end" className="@max-md:hidden" />
      </Button>
    </PopoverTrigger>
  );
}

/**
 * The filter's menu: several teams, with a search for a twenty- or
 * thirty-six-team league. The list behind it follows each tick. It is
 * rendered once, beside the days rather than under the pill (it is portalled,
 * so where it sits in the tree is all that changes), so a tick that moves the
 * pill to another day keeps the search, the highlight and the focus.
 *
 * A tick is `aria-checked`, not a selection: cmdk spends `aria-selected` on
 * its highlight, so the list is not `aria-multiselectable`.
 */
function TeamFilterMenu({
  options,
  picked,
  onPick,
}: {
  options: Team[];
  picked: readonly string[];
  onPick: (teamIds: readonly string[]) => void;
}): React.ReactElement {
  const chosen = new Set(picked);
  const toggle = (id: string): void =>
    onPick(chosen.has(id) ? picked.filter((p) => p !== id) : [...picked, id]);

  return (
    <PopoverContent aria-label="Filter by team" align="end" className="w-64 p-0">
      <Command label="Search teams">
        <CommandInput placeholder="Search teams…" />
        <CommandList label="Teams, pick one or more">
          <CommandEmpty>No team found.</CommandEmpty>
          {/* A rule under it rather than a separator, which a listbox may not hold. */}
          <CommandGroup className="border-b">
            <CommandItem
              value="All teams"
              data-checked={picked.length === 0}
              aria-checked={picked.length === 0}
              onSelect={() => onPick([])}
            >
              <ListFilter />
              All teams
            </CommandItem>
          </CommandGroup>
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
  );
}
