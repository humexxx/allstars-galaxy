import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { getF1DashboardStandings } from "@/lib/services/espn-f1-standings-service";
import { getF1News } from "@/lib/services/rapidapi-f1-news-service";
import {
  getF1DashboardHighlight,
  listUserFavoriteSportIds,
} from "@/lib/services/sports-service";
import { F1NextRace } from "@/components/entertainment/sports/f1-next-race";
import { F1StandingsTabs } from "@/components/entertainment/sports/f1-standings-tabs";
import {
  SPORT_CARD_HEADER,
  SPORT_CARD_ROWS,
  SPORT_CARD_SECTION,
} from "@/components/entertainment/sports/shared/dashboard-card-rows";
import { matchTimeFormat } from "@/components/entertainment/sports/shared/match-time";
import type { F1NewsImage } from "@/db/schema";

const F1_PATH = "/portal/entertainment/sports?sport=f1";
/** A slider, so more than fits is fine — but not so many nobody reaches the end. */
const SHOWN = 8;

/** The widest image the provider sent — its list runs small crops to full bleed. */
function thumbnail(images: F1NewsImage[]): F1NewsImage | null {
  if (images.length === 0) return null;
  return images.reduce((best, i) => ((i.width ?? 0) > (best.width ?? 0) ? i : best));
}

/**
 * Formula 1 on the dashboard: the next race and the wire, in one card.
 *
 * Its own card rather than `DashboardSportCard`, because F1 is a calendar of
 * races and a news feed, not fixtures between two teams. Sized to a grid
 * column rather than the full row: it is one sport among several, not a
 * banner.
 *
 * Gated on the favourite, like everything else on this dashboard. A motorsport
 * feed on the desk of somebody who does not follow it is noise.
 */
export async function DashboardF1Card({ userId }: { userId: string }) {
  const favorites = await listUserFavoriteSportIds(userId);
  if (!favorites.includes("f1")) return null;

  const [highlight, news, standings, timeZone] = await Promise.all([
    getF1DashboardHighlight(),
    getF1News(SHOWN),
    getF1DashboardStandings(3),
    getRequestTimeZone(),
  ]);
  // The reader's day, not the server's (UTC): a story from 22:00 in Costa
  // Rica belongs to that evening, not tomorrow.
  const format = matchTimeFormat(timeZone);
  if (!highlight && news.length === 0) return null;

  return (
    // Half the row: one sport among several, its rows lined up with the
    // card beside it (`dashboard-card-rows.ts`).
    <Card className={SPORT_CARD_ROWS}>
      <CardHeader className={SPORT_CARD_HEADER}>
        {/* The hub's emoji, like the other sport cards. */}
        <CardTitle as="h2" className="flex items-center gap-2">
          <span aria-hidden className="text-lg leading-none">
            🏎️
          </span>
          Formula 1
        </CardTitle>
        {highlight && (
          <CardDescription className="truncate">{highlight.season} World Championship</CardDescription>
        )}
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={F1_PATH}>
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <div className={SPORT_CARD_SECTION}>
        {highlight && <F1NextRace highlight={highlight} format={format} href={F1_PATH} />}
      </div>

      <div className={SPORT_CARD_SECTION}>
        {standings && (
          <F1StandingsTabs
            drivers={standings.drivers}
            constructors={standings.constructors}
          />
        )}
      </div>

      <div className={SPORT_CARD_SECTION}>
        {news.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow size="sm">Latest news</Eyebrow>
            {/* Scroll-snap rather than a carousel library: the card is narrow,
                a swipe is the gesture people already use here, and it adds no
                dependency. The rail is the same one the travel gallery uses. */}
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
              {news.map((item) => {
                const image = thumbnail(item.images);
                return (
                  <Link
                    key={item.id}
                    href={`/news/f1/${item.id}`}
                    className="group flex w-44 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-2 transition-colors hover:bg-muted/40"
                  >
                    {image?.url && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                        <Image
                          src={image.url}
                          alt={image.alt ?? item.headline}
                          fill
                          sizes="176px"
                          className="object-cover"
                          // The provider's CDN is whatever ESPN is using that
                          // week; an allowlist would break the day it changes.
                          unoptimized
                        />
                      </div>
                    )}
                    <span className="line-clamp-3 text-xs font-medium leading-snug">
                      {item.headline}
                    </span>
                    <Mono className="mt-auto text-2xs text-muted-foreground">
                      {format.shortDay(item.firstSeenAt)}
                    </Mono>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
