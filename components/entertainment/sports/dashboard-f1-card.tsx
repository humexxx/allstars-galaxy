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
import { NewsRail } from "@/components/entertainment/sports/shared/news-rail";
import { fromF1Wire } from "@/lib/sports/news";
import { sportPath } from "@/lib/sports/paths";

/** A slider, so more than fits is fine — but not so many nobody reaches the end. */
const SHOWN = 8;

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
            <Link href={sportPath("f1")}>
              Open <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <div className={SPORT_CARD_SECTION}>
        {highlight && <F1NextRace highlight={highlight} format={format} href={sportPath("f1")} />}
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
        <NewsRail stories={fromF1Wire(news)} format={format} />
      </div>
    </Card>
  );
}
