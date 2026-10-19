"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MapPin,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { comingUp, featuredTournament, justFinished } from "@/lib/sports/racquet";
import { cn } from "@/lib/utils";
import { formatDayRange, formatMonthLong, formatShortDay } from "@/lib/utils/date";
import type { RacquetCalendarEntry, RacquetData, RacquetTournament } from "@/types/sports";

import { StatusPill } from "../shared/status-pill";
import { DrawBody, type DrawState, type DrawVariant } from "./racquet-draw";

const JUST_FINISHED = 3;
const COMING_UP = 3;

/** A calendar line in the shape the cards and the sheet read: no place, no draw. */
function fromCalendar(entry: RacquetCalendarEntry): RacquetTournament {
  return { ...entry, location: "" };
}

/**
 * The feed's tournaments with the rest of the season's calendar behind them,
 * in date order. Tennis's feed covers only a fortnight either side of today;
 * read off it alone, "coming up" would stop two weeks out.
 */
export function seasonOf(data: RacquetData): RacquetTournament[] {
  const listed = new Set(data.tournaments.map((t) => t.id));
  const rest = (data.calendar ?? []).filter((e) => !listed.has(e.id)).map(fromCalendar);
  return [...data.tournaments, ...rest].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** A tournament of the tour by id, from the feed or, failing that, the calendar. */
export function findTournament(data: RacquetData, id: string): RacquetTournament | undefined {
  const listed = data.tournaments.find((t) => t.id === id);
  if (listed) return listed;
  const entry = data.calendar?.find((e) => e.id === id);
  return entry ? fromCalendar(entry) : undefined;
}

/** "Allianz Cloud Milano, Milan", "Shanghai, China PR" — or the city alone. */
function placeOf(t: RacquetTournament): string | null {
  const city = t.location && t.location !== "—" ? t.location : undefined;
  if (t.venue && city && !t.venue.includes(city)) return `${t.venue}, ${city}`;
  return t.venue ?? city ?? null;
}

function prizeOf(prize: RacquetTournament["prize"]): string | null {
  if (!prize) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: prize.currency,
      maximumFractionDigits: 0,
    }).format(prize.amount);
  } catch {
    return null;
  }
}

/** "Oct 12 – 18", "Sep 28 – Oct 4": a season's list needs no year on every line. */
function shortRange(start: string, end: string): string {
  if (start === end) return formatShortDay(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${formatShortDay(start)} – ${Number(end.slice(8, 10))}`;
  return `${formatShortDay(start)} – ${formatShortDay(end)}`;
}

/**
 * The event's poster, unoptimized: it comes off the provider's media host,
 * which is not on the optimizer's allowlist — the call `Portrait` makes for
 * faces. A poster that fails to load is left out rather than drawn broken.
 */
export function TournamentPoster({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span
      className={cn("relative block aspect-video shrink-0 overflow-hidden rounded-lg bg-muted", className)}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 768px) 24rem, 100vw"
        className="object-cover"
        unoptimized
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** "Champions" for a pair, "Champion" for a player. */
function championLabel(variant: DrawVariant): string {
  return variant === "pair" ? "Champions" : "Champion";
}

type Fact = { label: string; icon: LucideIcon; iconClassName?: string; value: ReactNode };

/** The facts a tournament has, one per line, each behind its icon. */
export function TournamentFacts({
  tournament: t,
  variant,
}: {
  tournament: RacquetTournament;
  variant: DrawVariant;
}) {
  const place = placeOf(t);
  const prize = prizeOf(t.prize);
  const facts: Fact[] = [
    {
      label: "Dates",
      icon: CalendarDays,
      value: <Mono>{formatDayRange(t.startDate, t.endDate)}</Mono>,
    },
  ];
  if (place) facts.push({ label: "Venue", icon: MapPin, value: place });
  if (prize) facts.push({ label: "Prize money", icon: Banknote, value: <Mono>{prize}</Mono> });
  if (t.status === "completed" && t.champion) {
    facts.push({
      label: championLabel(variant),
      icon: Trophy,
      iconClassName: "text-warning",
      value: <ChampionLine champion={t.champion} runnerUp={t.runnerUp} />,
    });
  } else if (t.defendingChampion) {
    facts.push({
      label: "Defending champion",
      icon: Shield,
      value: (
        <>
          {t.defendingChampion}
          <span className="text-muted-foreground"> defends the title</span>
        </>
      ),
    });
  }

  return (
    <dl className="flex flex-col gap-2">
      {facts.map(({ label, icon: Icon, iconClassName, value }) => (
        <div key={label} className="flex items-start gap-2 text-sm">
          <dt className="flex h-6 shrink-0 items-center text-muted-foreground">
            <Icon aria-hidden className={cn("size-4", iconClassName)} />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="min-w-0 leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChampionLine({ champion, runnerUp }: { champion: string; runnerUp?: string }) {
  return (
    <>
      <span className="font-medium">{champion}</span>
      {runnerUp && <span className="text-muted-foreground"> d. {runnerUp}</span>}
    </>
  );
}

/**
 * The card's title as its button, stretched over the whole card: a heading
 * inside a `<button>` is not allowed, a button inside a heading is.
 */
function OpenButton({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
    >
      {children}
    </button>
  );
}

/** The live tournament, else the next: big, with its poster where it has one. */
function FeaturedCard({
  tournament: t,
  variant,
  onOpen,
}: {
  tournament: RacquetTournament;
  variant: DrawVariant;
  onOpen: (id: string) => void;
}) {
  return (
    <Card className="relative transition-colors hover:bg-muted/40">
      <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:gap-6">
        {t.imageUrl && (
          <TournamentPoster key={t.imageUrl} src={t.imageUrl} className="@2xl:w-2/5" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>{t.status === "live" ? "On now" : "Next up"}</Eyebrow>
            {t.tier && <Badge variant="outline">{t.tier}</Badge>}
            {t.status === "live" && <StatusPill status="live" />}
          </div>
          <Heading level="h4" as="h3">
            <OpenButton onOpen={() => onOpen(t.id)}>{t.name}</OpenButton>
          </Heading>
          <TournamentFacts tournament={t} variant={variant} />
        </div>
        <ChevronRight aria-hidden className="hidden size-5 shrink-0 text-muted-foreground @2xl:block" />
      </CardContent>
    </Card>
  );
}

/** One tournament in a row of cards: what, where, when — and who won, once somebody has. */
function TournamentCard({
  tournament: t,
  onOpen,
}: {
  tournament: RacquetTournament;
  onOpen: (id: string) => void;
}) {
  const place = placeOf(t);
  const kind = t.tier ?? t.surface;
  return (
    <Card size="sm" className="relative transition-colors hover:bg-muted/40">
      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col leading-tight">
            {kind && (
              <Eyebrow size="sm" as="div">
                {kind}
              </Eyebrow>
            )}
            <Heading level="h6" as="h4">
              <OpenButton onOpen={() => onOpen(t.id)}>{t.name}</OpenButton>
            </Heading>
            {place && (
              <Text variant="small" as="div" className="truncate">
                {place}
              </Text>
            )}
          </div>
          <StatusPill status={t.status} />
        </div>
        <Mono className="block text-xs text-muted-foreground">
          {formatDayRange(t.startDate, t.endDate)}
        </Mono>
        {/* Pinned to the bottom, so the results line up along a row whatever
            the names above them wrap to. */}
        {t.status === "completed" && t.champion ? (
          <div className="mt-auto flex items-start gap-2 border-t pt-2 text-xs">
            <Trophy className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Champion" />
            <span className="min-w-0">
              <ChampionLine champion={t.champion} runnerUp={t.runnerUp} />
            </span>
          </div>
        ) : t.defendingChampion ? (
          <div className="mt-auto flex items-start gap-2 border-t pt-2 text-xs text-muted-foreground">
            <Shield className="mt-0.5 size-3.5 shrink-0" aria-label="Defending champion" />
            <span className="min-w-0">{t.defendingChampion} defends the title</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <Heading level="h6" as="h3">
        {title}
      </Heading>
      {children}
    </section>
  );
}

function CardRow({
  tournaments,
  onOpen,
}: {
  tournaments: RacquetTournament[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
      {tournaments.map((t) => (
        <TournamentCard key={t.id} tournament={t} onOpen={onOpen} />
      ))}
    </div>
  );
}

/**
 * The Tournaments tab, the way F1 shows its races: the event on now (else the
 * next) big, the last few results before it, what follows, and the whole
 * season one tap away. Every card opens the tournament's sheet.
 */
export function RacquetTournaments({
  data,
  variant,
  onOpen,
}: {
  data: RacquetData;
  variant: DrawVariant;
  onOpen: (id: string) => void;
}) {
  const season = useMemo(() => seasonOf(data), [data]);
  // From the feed's own list first: it is the one whose draw travelled with
  // the page. The calendar only stands in when the feed has nothing ahead.
  const featured = featuredTournament(data.tournaments) ?? featuredTournament(season);
  const alsoOn = season.filter((t) => t.status === "live" && t.id !== featured?.id);
  const finished = justFinished(season, JUST_FINISHED);
  const next = comingUp(season, COMING_UP, featured?.id);

  if (season.length === 0) {
    return <EmptyState icon={CalendarDays} title="No tournaments on the calendar for this tour." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {featured ? (
        <FeaturedCard tournament={featured} variant={variant} onOpen={onOpen} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="The season is over"
          description="Next season's calendar is not out yet."
        />
      )}
      {alsoOn.length > 0 && (
        <Section title="Also on">
          <CardRow tournaments={alsoOn} onOpen={onOpen} />
        </Section>
      )}
      {finished.length > 0 && (
        <Section title="Just finished">
          <CardRow tournaments={finished} onOpen={onOpen} />
        </Section>
      )}
      {next.length > 0 && (
        <Section title="Coming up">
          <CardRow tournaments={next} onOpen={onOpen} />
        </Section>
      )}
      <FullCalendar season={season} onOpen={onOpen} />
    </div>
  );
}

/** The whole season by month, folded away until asked for. */
function FullCalendar({
  season,
  onOpen,
}: {
  season: RacquetTournament[];
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => {
    const byMonth = new Map<string, RacquetTournament[]>();
    for (const t of season) {
      const month = t.startDate.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), t]);
    }
    return [...byMonth.entries()].map(([month, entries]) => ({
      month,
      label: formatMonthLong(`${month}-01`),
      entries,
    }));
  }, [season]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="self-start">
          <CalendarDays />
          Full calendar
          <Mono className="text-muted-foreground">{season.length}</Mono>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card size="sm">
          <CardContent>
            <ol className="flex flex-col gap-4">
              {months.map(({ month, label, entries }) => (
                <li key={month} className="flex flex-col gap-1">
                  <Eyebrow size="sm" as="div">
                    {label}
                  </Eyebrow>
                  <ul className="flex flex-col">
                    {entries.map((t) => (
                      <li key={t.id}>
                        <CalendarRow tournament={t} onOpen={onOpen} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CalendarRow({
  tournament: t,
  onOpen,
}: {
  tournament: RacquetTournament;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(t.id)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Mono className="w-28 shrink-0 text-xs text-muted-foreground">
        {shortRange(t.startDate, t.endDate)}
      </Mono>
      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" weight="medium" className="truncate">
          {t.name}
        </Text>
        {t.status === "completed" && t.champion && (
          <Text as="span" variant="small" className="truncate">
            {t.champion}
          </Text>
        )}
      </span>
      {/* Upcoming goes without saying in a list by date; only "live" is news. */}
      {t.status === "live" && <StatusPill status="live" />}
    </button>
  );
}

/**
 * The Current tab: the tournament being played, else the one just finished,
 * with its draw inline.
 */
export function RacquetCurrent({
  tournament: t,
  draw,
  variant,
  onOpen,
  onRetry,
}: {
  tournament: RacquetTournament | undefined;
  draw: DrawState;
  variant: DrawVariant;
  onOpen: (id: string) => void;
  onRetry?: () => void;
}) {
  if (!t) {
    return (
      <EmptyState
        icon={Trophy}
        title="Nothing on and nothing just finished"
        description="The next tournament is under Tournaments."
      />
    );
  }

  const place = placeOf(t);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-end @2xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>{t.status === "live" ? "On now" : "Just finished"}</Eyebrow>
            {t.tier && <Badge variant="outline">{t.tier}</Badge>}
            <StatusPill status={t.status} />
          </div>
          <Heading level="h4" as="h3">
            {t.name}
          </Heading>
          <Text variant="muted">
            {[formatDayRange(t.startDate, t.endDate), place].filter(Boolean).join(" · ")}
          </Text>
        </div>
        <Button variant="outline" size="sm" className="self-start @2xl:self-auto" onClick={() => onOpen(t.id)}>
          Details
          <ChevronRight />
        </Button>
      </div>
      {t.status === "completed" && t.champion && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm dark:bg-warning/20">
          <Trophy className="mt-0.5 size-4 shrink-0 text-warning" aria-label={championLabel(variant)} />
          <span className="min-w-0">
            <ChampionLine champion={t.champion} runnerUp={t.runnerUp} />
          </span>
        </div>
      )}
      <Card size="sm">
        <CardContent>
          <DrawBody tournament={t} state={draw} variant={variant} onRetry={onRetry} />
        </CardContent>
      </Card>
    </div>
  );
}
