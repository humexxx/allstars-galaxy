"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Banknote, CalendarDays, MapPin, Shield, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { cityOf, justFinished, placeOf, playLine, seasonOf, topSeeds } from "@/lib/sports/racquet";
import { cn } from "@/lib/utils";
import { formatDayRange } from "@/lib/utils/date";
import type { DrawVariant, RacquetData, RacquetDraw, RacquetTournament, Team } from "@/types/sports";

import { PairFaces } from "../shared/draw-match-card";
import { FactList, TileWinner, VersusLine, type Fact } from "../shared/event-facts";
import { Portrait } from "../shared/portrait";
import { StatusPill } from "../shared/status-pill";
import {
  EarlierPill,
  SectionHeading,
  showNames,
  TILE,
  TileSection,
  useRevealEarlier,
  ViewDetailsLink,
} from "../shared/tile-section";

/** A tournament on now by its city, or by its name where two share one. */
function chipLabel(t: RacquetTournament, all: RacquetTournament[]): string {
  const city = cityOf(t);
  return city && all.filter((o) => cityOf(o) === city).length === 1 ? city : t.name;
}

/** What a tournament is, in one word: its tier, else its surface. */
function kindOf(t: RacquetTournament): string | undefined {
  return t.tier ?? t.surface;
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

/** "Champions" for a pair, "Champion" for a player. */
function championLabel(variant: DrawVariant): string {
  return variant === "pair" ? "Champions" : "Champion";
}

/** The facts a tournament has, one per line, each behind its icon. */
export function TournamentFacts({
  tournament: t,
  variant,
}: {
  tournament: RacquetTournament;
  variant: DrawVariant;
}): React.ReactElement {
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
      value: <VersusLine winner={t.champion} runnerUp={t.runnerUp} />,
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

  return <FactList facts={facts} />;
}

/**
 * Who leads the draw — a week of tennis splits the best players between
 * three or four events, and the seeds say which one has them. Just the
 * faces, big (a pair's two), each surname small under it for a player with
 * no photo, the seed in its tooltip and for a screen reader.
 */
function TopSeeds({ seeds, variant }: { seeds: Team[]; variant: DrawVariant }): React.ReactElement {
  return (
    <ol aria-label="Top seeds" className="flex shrink-0 items-start gap-2">
      {seeds.map((p) => {
        // A pair's "Coello / Tapia" closes up; a player goes by the surname.
        const label = variant === "pair" ? p.shortName.replace(" / ", "/") : p.shortName.split(" ").slice(-1)[0];
        return (
          <li
            key={p.id}
            title={`Seed ${p.code}: ${variant === "pair" ? p.name : p.shortName}`}
            className={cn("flex flex-col items-center gap-1", variant === "pair" ? "w-18" : "w-14")}
          >
            {variant === "pair" ? (
              <PairFaces pair={p} size="lg" />
            ) : (
              <Portrait
                size="lg"
                subject={{ name: p.shortName, imageUrl: p.logoUrl, flagEmoji: p.name }}
                fallback={<span className="text-2xl leading-none">{p.name}</span>}
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
  );
}

/**
 * A tournament's card: its poster where it has one, beside the content and
 * flush with the card's edge (the card clips it to its corners), above it on
 * a phone; the draw's best seeds go to the content as `corner` to place. The
 * poster comes off the provider's media host, unoptimized like `Portrait`'s
 * faces.
 *
 * Key it by tournament where the tournament can change, or a failed poster
 * is remembered for the next one.
 */
export function TournamentCard({
  tournament: t,
  seeds,
  variant,
  children,
}: {
  tournament: RacquetTournament;
  seeds: Team[];
  variant: DrawVariant;
  children: (corner: ReactNode) => ReactNode;
}): React.ReactElement {
  const [posterGone, setPosterGone] = useState(false);
  const poster = posterGone ? undefined : t.imageUrl;
  const corner = seeds.length > 0 ? <TopSeeds seeds={seeds} variant={variant} /> : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 @2xl:flex-row @2xl:items-stretch @2xl:gap-6">
        {poster && (
          // Padel's posters are A-format, portrait (1132×1600): beside the
          // content the box keeps their shape, so the whole poster shows, and
          // the card is at least its height. A 2:5 share of the card's width
          // cut the top and the foot off, the event's name among them.
          <span className="relative block aspect-video shrink-0 overflow-hidden rounded-lg bg-muted @2xl:-my-6 @2xl:-ml-6 @2xl:aspect-5/7 @2xl:w-56 @2xl:rounded-none">
            <Image src={poster} alt="" fill className="object-cover" unoptimized onError={() => setPosterGone(true)} />
          </span>
        )}
        {children(corner)}
      </CardContent>
    </Card>
  );
}

/**
 * The tournament on now, else the next, as F1's next race: big, its poster
 * where it has one, its facts, and at its foot the round under way (nothing
 * before play starts) beside "View details", to the tournament's own page.
 * The card itself stays still.
 */
function FeaturedTournament({
  tournament: t,
  draw,
  variant,
  today,
  href,
}: {
  tournament: RacquetTournament;
  draw?: RacquetDraw;
  variant: DrawVariant;
  today: string;
  href: string;
}): React.ReactElement {
  const kind = kindOf(t);
  const line = t.status === "live" ? playLine(t, draw?.rounds, today) : null;
  return (
    <TournamentCard tournament={t} seeds={draw ? topSeeds(draw) : []} variant={variant}>
      {(corner) => (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {kind && <Badge variant="outline">{kind}</Badge>}
              <StatusPill status={t.status} />
            </div>
            {corner}
          </div>
          <Heading level="h3">{t.name}</Heading>
          <TournamentFacts tournament={t} variant={variant} />
          {/* At the card's foot, clear of the facts: the round under way, once
              play has started, beside the way to the tournament's page. */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-2">
            {line && (
              <Text variant="muted" className="mr-auto">
                {line}
              </Text>
            )}
            <ViewDetailsLink href={href} name={t.name} />
          </div>
        </div>
      )}
    </TournamentCard>
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
}: {
  tournament: RacquetTournament;
  onNow: RacquetTournament[];
  onPick: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
      <SectionHeading>{t.status === "live" ? "On now" : "Next up"}</SectionHeading>
      {onNow.length > 1 && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={t.id}
          onValueChange={(id) => id && onPick(id)}
          aria-label="Tournaments on now"
          className="@md:-my-1.5 @md:justify-end"
        >
          {onNow.map((o) => {
            const label = chipLabel(o, onNow);
            return (
              <ToggleGroupItem
                key={o.id}
                value={o.id}
                // The name a screen reader hears starts with the city on the pill.
                aria-label={label === o.name ? undefined : `${label}, ${o.name}`}
                // Foreground on the tint: primary text on it is under 4.5:1. The
                // full primary border keeps the pick visible.
                className="h-6 rounded-full px-2.5 data-[state=on]:border-primary data-[state=on]:text-foreground"
              >
                {label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      )}
    </div>
  );
}

/** One tournament as a tile to its page: what, where, when — and who won, once somebody has. */
function TournamentTile({ tournament: t, href }: { tournament: RacquetTournament; href: string }): React.ReactElement {
  const place = placeOf(t);
  const kind = kindOf(t);
  return (
    <Link href={href} data-tournament={t.id} className={cn(TILE, "gap-2")}>
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
        <TileWinner label="Champion">
          <VersusLine winner={t.champion} runnerUp={t.runnerUp} />
        </TileWinner>
      ) : t.defendingChampion ? (
        <span className="flex items-start gap-2 border-t pt-2 text-xs text-muted-foreground">
          <Shield aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">{t.defendingChampion} defends the title</span>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The left of padel's and tennis's Overview, laid out as F1's races: the
 * tournament on now (a pill each when several are) or the next, big; every
 * tournament still to come after it; and the ones played, latest first,
 * brought in from their heading (`useRevealEarlier`). Every tile opens the
 * tournament's own page.
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
  hrefFor,
}: {
  data: RacquetData;
  /** The tournament on now (the one picked, else the first) or the next. */
  featured: RacquetTournament | undefined;
  /** Its draw, for the round under way and the seeds. */
  draw?: RacquetDraw;
  variant: DrawVariant;
  today: string;
  onNow: RacquetTournament[];
  onPick: (id: string) => void;
  /** A tournament's own page. */
  hrefFor: (id: string) => string;
}): React.ReactElement {
  const season = useMemo(() => seasonOf(data), [data]);
  // Every one still to start; those being played are the pills on the heading.
  const ahead = season.filter((t) => t.status === "upcoming" && t.id !== featured?.id);
  const played = useMemo(() => justFinished(season, season.length), [season]);
  const { listRef, earlier, next, reveal } = useRevealEarlier(played, {
    open: !featured,
    attr: "data-tournament",
  });

  if (season.length === 0) {
    return <EmptyState icon={CalendarDays} title="No tournaments on the calendar for this tour." />;
  }

  return (
    <div ref={listRef} className="@container flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-2">
        {featured ? (
          <>
            <OnNowHeading tournament={featured} onNow={onNow} onPick={onPick} />
            <FeaturedTournament
              key={featured.id}
              tournament={featured}
              draw={draw}
              variant={variant}
              today={today}
              href={hrefFor(featured.id)}
            />
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
            <TournamentTile key={t.id} tournament={t} href={hrefFor(t.id)} />
          ))}
        </TileSection>
      )}

      {played.length > 0 && (
        <TileSection
          title="Earlier tournaments"
          action={next.length > 0 && <EarlierPill detail={showNames(next)} onClick={reveal} />}
        >
          {earlier.map((t) => (
            <TournamentTile key={t.id} tournament={t} href={hrefFor(t.id)} />
          ))}
        </TileSection>
      )}
    </div>
  );
}
