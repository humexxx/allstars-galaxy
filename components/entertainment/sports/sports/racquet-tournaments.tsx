"use client";

import Image from "next/image";
import { Children, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  History,
  Maximize2,
  MapPin,
  Shield,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { roundInPlay } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/lib/utils/date";
import type { RacquetCalendarEntry, RacquetData, RacquetDraw, RacquetTournament, Team } from "@/types/sports";

import { PairFaces } from "../shared/draw-match-card";
import { Portrait } from "../shared/portrait";
import { fadeIn, holdScrollStill } from "../shared/reveal";
import { RevealPill } from "../shared/reveal-pill";
import { StatusPill } from "../shared/status-pill";
import { DrawBody, type DrawState, type DrawVariant } from "./racquet-draw";

/** Tournaments run that a tap on "Earlier" brings in, and that show once the season is over. */
const EARLIER_STEP = 3;

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

/** A tournament on now by its city, or by its name where two share one. */
function chipLabel(t: RacquetTournament, all: RacquetTournament[]): string {
  const city = t.location && t.location !== "—" ? t.location : undefined;
  return city && all.filter((o) => o.location === city).length === 1 ? city : t.name;
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


// A tile is a button, but it does not grey on hover: its border firms up.
const TILE =
  "flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/50";

/** The size, padding and gap of a day heading in `MatchesByDate`. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Eyebrow size="sm" asChild>
      <h3 className="py-1">{children}</h3>
    </Eyebrow>
  );
}

function TileSection({
  title,
  action,
  children,
}: {
  title: string;
  /** At the end of the heading's line: the pill that brings in more. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading>{title}</SectionHeading>
        {action}
      </div>
      {Children.count(children) > 0 && (
        <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

/**
 * The heading over the tournament on now, and with two or more being played
 * (a week of tennis is three or four) a pill for each on its line, its
 * negative margins keeping the line as tall as the Rankings label beside it.
 * Under it on a phone.
 */
function OnNowHeading({
  tournament: t,
  onNow,
  onPick,
  idle,
}: {
  tournament: RacquetTournament;
  onNow: RacquetTournament[];
  onPick?: (id: string) => void;
  /** What the heading says while nothing is being played. */
  idle: string;
}) {
  return (
    <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
      <SectionHeading>{t.status === "live" ? "On now" : idle}</SectionHeading>
      {onNow.length > 1 && onPick && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={t.id}
          onValueChange={(id) => id && onPick(id)}
          aria-label="Tournaments on now"
          className="@md:-my-1.5 @md:justify-end"
        >
          {onNow.map((o) => (
            <ToggleGroupItem key={o.id} value={o.id} aria-label={o.name} className="h-6 rounded-full px-2.5">
              {chipLabel(o, onNow)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}

/**
 * The draw's three best seeds, among the players in its own rounds: the
 * tour's list of players spans every draw the page carries.
 */
function topSeeds(draw: RacquetDraw): Team[] {
  const inDraw = new Set(draw.rounds.flatMap((r) => r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
  return draw.players
    .filter((p) => inDraw.has(p.id) && /^\d+$/.test(p.code.trim()))
    .sort((a, b) => Number(a.code) - Number(b.code))
    .slice(0, 3);
}

/**
 * Who leads the draw — a week of tennis splits the best players between
 * three or four events, and the seeds say which one has them. A face each
 * (a pair's two), the surname under it, the seed in its tooltip.
 */
function TopSeeds({ seeds, variant }: { seeds: Team[]; variant: DrawVariant }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <Eyebrow size="sm" as="div">
        Top seeds
      </Eyebrow>
      <ol className="flex items-start gap-2">
        {seeds.map((p) => {
          // A pair's "Coello / Tapia" closes up; a player goes by the surname.
          const label = variant === "pair" ? p.shortName.replace(" / ", "/") : p.shortName.split(" ").slice(-1)[0];
          return (
            <li
              key={p.id}
              title={`Seed ${p.code}: ${variant === "pair" ? p.name : p.shortName}`}
              className="flex w-14 flex-col items-center gap-1"
            >
              {variant === "pair" ? (
                <PairFaces pair={p} size="md" />
              ) : (
                <Portrait
                  subject={{ name: p.shortName, imageUrl: p.logoUrl, flagEmoji: p.name }}
                  fallback={<span className="text-base leading-none">{p.name}</span>}
                />
              )}
              <span className="w-full truncate text-center text-2xs text-muted-foreground">
                <span className="sr-only">Seed {p.code}: </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Starts today", "Starts tomorrow", "Starts in 5 days" — by the reader's calendar day. */
function startsIn(startDate: string, today: string): string {
  const days = Math.round((Date.parse(startDate) - Date.parse(today)) / 86_400_000);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

/**
 * The tournament on now, else the next, as F1's next race: big, its poster
 * where it has one, its facts, the round under way (or when it starts), and
 * "View details" at its foot on the right. The card itself stays still.
 */
function FeaturedTournament({
  tournament: t,
  draw,
  variant,
  today,
  onOpen,
}: {
  tournament: RacquetTournament;
  draw?: DrawState;
  variant: DrawVariant;
  today: string;
  onOpen: (id: string) => void;
}) {
  const ready = draw?.status === "ready" ? draw.draw : undefined;
  const round = t.status === "live" && ready ? roundInPlay(ready.rounds) : undefined;
  const seeds = ready ? topSeeds(ready) : [];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-start @2xl:gap-6">
        {t.imageUrl && <TournamentPoster key={t.imageUrl} src={t.imageUrl} className="@2xl:w-2/5" />}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {t.tier && <Badge variant="outline">{t.tier}</Badge>}
              {t.surface && !t.tier && <Badge variant="outline">{t.surface}</Badge>}
              <StatusPill status={t.status} />
            </div>
            {seeds.length > 0 && <TopSeeds seeds={seeds} variant={variant} />}
          </div>
          <Heading level="h3" as="h4">
            {t.name}
          </Heading>
          <TournamentFacts tournament={t} variant={variant} />
          {/* Holds a line's height either way, so the button does not jump. */}
          <Text as="p" weight="medium" className="min-h-6">
            {t.status === "live" ? (round ? `${round.label} under way` : null) : startsIn(t.startDate, today)}
          </Text>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              aria-label={`View details: ${t.name}`}
              onClick={() => onOpen(t.id)}
            >
              View details
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** One tournament as a tile: what, where, when — and who won, once somebody has. */
function TournamentTile({
  tournament: t,
  onOpen,
}: {
  tournament: RacquetTournament;
  onOpen: (id: string, opener: HTMLElement) => void;
}) {
  const place = placeOf(t);
  const kind = t.tier ?? t.surface;
  return (
    <button
      type="button"
      data-tournament={t.id}
      onClick={(event) => onOpen(t.id, event.currentTarget)}
      className={TILE}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col leading-tight">
          {kind && (
            <Eyebrow size="sm" as="span">
              {kind}
            </Eyebrow>
          )}
          <Text as="span" weight="semibold" className="truncate">
            {t.name}
          </Text>
        </span>
        {t.status === "live" && <StatusPill status="live" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        {place && (
          <Text variant="small" as="span" className="truncate">
            {place}
          </Text>
        )}
        <Mono className="text-xs text-muted-foreground">{formatDayRange(t.startDate, t.endDate)}</Mono>
      </span>
      {t.status === "completed" && t.champion ? (
        <span className="flex items-start gap-2 border-t pt-2 text-xs">
          <Trophy className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Champion" />
          <span className="min-w-0">
            <ChampionLine champion={t.champion} runnerUp={t.runnerUp} />
          </span>
        </span>
      ) : t.defendingChampion ? (
        <span className="flex items-start gap-2 border-t pt-2 text-xs text-muted-foreground">
          <Shield className="mt-0.5 size-3.5 shrink-0" aria-label="Defending champion" />
          <span className="min-w-0">{t.defendingChampion} defends the title</span>
        </span>
      ) : null}
    </button>
  );
}

/** What a tap brings in: "Show Shanghai – Paris", or one name. */
function showNames(list: RacquetTournament[]): string {
  return list.length > 1 ? `Show ${list[0].name} – ${list[list.length - 1].name}` : `Show ${list[0]?.name ?? ""}`;
}

/**
 * The left of padel's and tennis's Overview, laid out as F1's races: the
 * tournament on now (a pill each when several are) or the next, big; every
 * tournament still to come after it; and the ones played — none until asked
 * for: "Earlier" on their line brings in three a tap, latest first, right
 * where it was tapped. Every tile opens the tournament's sheet.
 *
 * Its own container, so the tiles follow the column's width. Each part opens
 * on a heading set like a day heading, which puts the first card level with
 * the rankings card beside it (`OverviewSplit`).
 */
export function RacquetOverview({
  data,
  featured,
  draw,
  variant,
  today,
  onNow,
  onPick,
  onOpen,
}: {
  data: RacquetData;
  /** The tournament on now (the one picked, else the first) or the next. */
  featured: RacquetTournament | undefined;
  /** Its draw, for the round under way. */
  draw?: DrawState;
  variant: DrawVariant;
  today: string;
  onNow: RacquetTournament[];
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const season = useMemo(() => seasonOf(data), [data]);
  // Every one still to start; those being played are the pills on the heading.
  const ahead = season.filter((t) => t.status === "upcoming" && t.id !== featured?.id);
  const played = useMemo(
    () => season.filter((t) => t.status === "completed").sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [season]
  );

  // The tournaments played that are shown. None while there is one to come;
  // once the season is over they are all there is, so it opens on the last few.
  const [shownEarlier, setShownEarlier] = useState(featured ? 0 : EARLIER_STEP);
  const listRef = useRef<HTMLDivElement>(null);
  const added = useRef<string[] | null>(null);
  const earlier = played.slice(0, shownEarlier);
  const nextEarlier = played.slice(earlier.length, earlier.length + EARLIER_STEP);

  // The new tiles are in under the ones shown: they fade in, and the focus
  // stays on the pill for more, or goes to the first of them once there is
  // nothing older.
  useLayoutEffect(() => {
    const ids = added.current;
    const root = listRef.current;
    added.current = null;
    if (!ids || !root) return;
    const tiles = ids
      .map((id) => root.querySelector<HTMLElement>(`[data-tournament="${id}"]`))
      .filter((t): t is HTMLElement => t !== null);
    const pill = root.querySelector<HTMLElement>("[data-reveal]");
    (pill ?? tiles[0])?.focus({ preventScroll: true });
    tiles.forEach((tile, i) => fadeIn(tile, i * 40));
  }, [shownEarlier]);

  const revealEarlier = (): void => {
    if (!listRef.current) return;
    holdScrollStill(listRef.current);
    added.current = nextEarlier.map((t) => t.id);
    setShownEarlier(shownEarlier + EARLIER_STEP);
  };

  if (season.length === 0) {
    return <EmptyState icon={CalendarDays} title="No tournaments on the calendar for this tour." />;
  }

  return (
    <div ref={listRef} className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        {featured ? (
          <>
            <OnNowHeading tournament={featured} onNow={onNow} onPick={onPick} idle="Next up" />
            <FeaturedTournament tournament={featured} draw={draw} variant={variant} today={today} onOpen={onOpen} />
          </>
        ) : (
          <>
            <SectionHeading>Next up</SectionHeading>
            <EmptyState
              icon={CalendarDays}
              title="The season is over"
              description="Every tournament is under Earlier tournaments below."
            />
          </>
        )}
      </section>

      {ahead.length > 0 && (
        <TileSection title="Coming up">
          {ahead.map((t) => (
            <TournamentTile key={t.id} tournament={t} onOpen={(id) => onOpen(id)} />
          ))}
        </TileSection>
      )}

      {played.length > 0 && (
        <TileSection
          title="Earlier tournaments"
          action={
            nextEarlier.length > 0 && (
              <RevealPill
                icon={History}
                label="Earlier"
                detail={showNames(nextEarlier)}
                data-reveal
                onClick={revealEarlier}
              />
            )
          }
        >
          {earlier.map((t) => (
            <TournamentTile key={t.id} tournament={t} onOpen={(id) => onOpen(id)} />
          ))}
        </TileSection>
      )}
    </div>
  );
}

/**
 * The Draw tab: the bracket of the tournament on now (a pill each when
 * several are), else of the one just finished, the whole width of the page,
 * and "Expand" to see it on the whole screen.
 */
export function RacquetDrawTab({
  tournament: t,
  draw,
  variant,
  onOpen,
  onRetry,
  onNow,
  onPick,
}: {
  tournament: RacquetTournament | undefined;
  draw: DrawState;
  variant: DrawVariant;
  onOpen: (id: string) => void;
  onRetry?: () => void;
  onNow: RacquetTournament[];
  onPick: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!t) {
    return (
      <EmptyState
        icon={Trophy}
        title="No draw to show yet"
        description="The first tournament of the season has not started."
      />
    );
  }

  const place = placeOf(t);
  const hasBracket = draw.status === "ready" && draw.draw.rounds.length > 0;
  return (
    <section className="@container flex min-w-0 flex-col gap-2">
      <OnNowHeading tournament={t} onNow={onNow} onPick={onPick} idle="Just finished" />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 @xl:flex-row @xl:items-start @xl:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {t.tier && <Badge variant="outline">{t.tier}</Badge>}
                <StatusPill status={t.status} />
              </div>
              <Heading level="h4" as="h4">
                {t.name}
              </Heading>
              <Text variant="muted">
                {[formatDayRange(t.startDate, t.endDate), place].filter(Boolean).join(" · ")}
              </Text>
            </div>
            <div className="flex gap-2 self-end @xl:self-auto">
              {hasBracket && (
                <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
                  <Maximize2 data-icon="inline-start" />
                  Expand
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                aria-label={`View details: ${t.name}`}
                onClick={() => onOpen(t.id)}
              >
                View details
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          {t.status === "completed" && t.champion && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm dark:bg-warning/20">
              <Trophy className="mt-0.5 size-4 shrink-0 text-warning" aria-label={championLabel(variant)} />
              <span className="min-w-0">
                <ChampionLine champion={t.champion} runnerUp={t.runnerUp} />
              </span>
            </div>
          )}
          <DrawBody tournament={t} state={draw} variant={variant} onRetry={onRetry} />
        </CardContent>
      </Card>

      {/* The bracket on the whole screen: a draw of 64 needs every column it can get. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-svh max-h-svh w-screen max-w-none flex-col gap-4 rounded-none sm:max-w-none max-sm:max-h-svh max-sm:rounded-none">
          <DialogHeader>
            <DialogTitle>{t.name}</DialogTitle>
            <DialogDescription>
              {[formatDayRange(t.startDate, t.endDate), place].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DrawBody tournament={t} state={draw} variant={variant} onRetry={onRetry} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
