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

/** Days one tap of the clock brings in: a matchday, a week of the NFL, three NBA nights. */
const EARLIER_STEP = 3;

/** The days already shown slide down, then the new ones fade in above them. */
const SLIDE_MS = 220;
const FADE_MS = 200;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

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

  const saveTeams = (teamIds: readonly string[]): void => {
    if (!saved) return;
    startSaving(async () => {
      await runAction(setSportTeamFilterAction({ ...saved.list, teamIds: [...teamIds] }), {
        failure: "Couldn't save your teams",
      });
    });
  };

  const earlierLabel = `Show ${step} earlier ${step === 1 ? "day" : "days"}`;

  const heading = (day: string): string => {
    const name = format.longDay(day);
    if (day === today) return `Today · ${name}`;
    return name;
  };

  return (
    // Its own container, so the columns follow the list's width: beside a
    // table it is two-thirds of the row, alone it is all of it.
    <section className={cn("@container flex min-w-0 flex-col", className)}>
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
                        data-earlier
                        onClick={revealEarlier}
                      >
                        <History className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{earlierLabel}</TooltipContent>
                  </Tooltip>
                )}
              </Eyebrow>
              <div className="grid gap-2 @xl:grid-cols-2 @5xl:grid-cols-3">
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

/**
 * Keeps the page where it is while days go in above the ones on screen.
 * Left alone, the browser's scroll anchoring scrolls down by the height
 * added, to keep the cards that were in view in place, and the new days land
 * above the screen. Anchoring comes back once the slide is over.
 */
function holdScrollStill(list: HTMLElement): void {
  const scroller = scrollParent(list);
  const held = scroller ? [scroller] : [document.documentElement, document.body];
  for (const el of held) el.style.overflowAnchor = "none";
  window.setTimeout(() => {
    for (const el of held) el.style.overflowAnchor = "";
  }, SLIDE_MS + FADE_MS);
}

/**
 * The days that were on screen slide from where they were to where they are
 * now (down, by the height of the days added), and the added days fade in
 * after them. Nothing moves for a reader who asked for less motion, or where
 * there is no Web Animations API (a test).
 */
function slideIn(list: HTMLElement, tops: Map<string, number>, added: string[]): void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of list.querySelectorAll<HTMLElement>("[data-day]")) {
    if (typeof el.animate !== "function") return;
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
      el.animate(
        [
          { opacity: 0, transform: "translateY(-0.5rem)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: FADE_MS, delay: SLIDE_MS / 2, easing: EASE, fill: "backwards" }
      );
    }
  }
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
