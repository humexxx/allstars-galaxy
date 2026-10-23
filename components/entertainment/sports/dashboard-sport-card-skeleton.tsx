import { Card, CardAction, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  SPORT_CARD_HEADER,
  SPORT_CARD_ROWS,
  SPORT_CARD_SECTION,
} from "./shared/dashboard-card-rows";

/**
 * A sport card's stand-in, cut into the same four rows (header, lead box,
 * match list, tables), so a pair of them takes the row tracks a pair of cards
 * will. The rows are typical heights — each sport fills them differently, the
 * cards measured 572–640px — close enough that the cards land without the
 * 400px drop a generic two-tile skeleton made.
 */
export function DashboardSportCardSkeleton(): React.ReactElement {
  return (
    <Card className={SPORT_CARD_ROWS} aria-hidden="true">
      <CardHeader className={SPORT_CARD_HEADER}>
        <Skeleton className="h-6 w-32 sm:h-7" />
        {/* The competition picker's trigger, 2px taller than a text line. */}
        <Skeleton className="h-5.5 w-44" />
        <CardAction>
          <Skeleton className="h-8 w-20" />
        </CardAction>
      </CardHeader>
      <div className={SPORT_CARD_SECTION}>
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <div className={SPORT_CARD_SECTION}>
        <SkeletonList rows={6} />
      </div>
      <div className={SPORT_CARD_SECTION}>
        <SkeletonList rows={4} />
      </div>
    </Card>
  );
}

/** An eyebrow over rows of match lines or table rows. */
function SkeletonList({ rows }: { rows: number }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-16" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
