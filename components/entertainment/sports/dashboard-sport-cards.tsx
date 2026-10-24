import { Suspense } from "react";
import Link from "next/link";
import { Star, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { listUserFavoriteSports } from "@/lib/services/sports-service";
import { SPORTS_PATH } from "@/lib/sports/paths";
import type { SportId } from "@/types/sports";

import { DashboardF1Card } from "./dashboard-f1-card";
import { DashboardSportCard } from "./dashboard-sport-card";
import { DashboardSportCardSkeleton } from "./dashboard-sport-card-skeleton";

/** The sports that have a dashboard card of their own. */
const CARD_SPORTS = new Set<SportId>(["football", "nba", "nfl", "lol", "tennis", "padel", "f1"]);

/**
 * One card per favourite sport, in the order they were picked, each on the
 * championship its favourite row is set to.
 *
 * Each sits in its own Suspense boundary: they wait on different providers,
 * and one slow feed should only hold up its own card. The cards are grid
 * items of the dashboard itself — Suspense and the fragment add no wrapper.
 */
export async function DashboardSportCards({ userId }: { userId: string }) {
  const favorites = (await listUserFavoriteSports(userId)).filter((f) => CARD_SPORTS.has(f.sportId));

  if (favorites.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Trophy className="size-5" aria-hidden />
            Sports
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text variant="muted">
            Pick a few favorite sports to see live results, standings and the next big match
            right here on your dashboard.
          </Text>
          <Button asChild>
            <Link href={SPORTS_PATH}>
              <Star /> Pick favorites
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {favorites.map(({ sportId, competition }) => (
        <Suspense
          key={sportId}
          // Four rows like the card it stands in for, or the cards after it
          // would take its rows (`dashboard-card-rows.ts`).
          fallback={<DashboardSportCardSkeleton />}
        >
          {sportId === "f1" ? (
            <DashboardF1Card userId={userId} />
          ) : (
            <DashboardSportCard sportId={sportId} competition={competition} />
          )}
        </Suspense>
      ))}
    </>
  );
}
