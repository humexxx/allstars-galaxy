import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardCardSkeletonProps = {
  /** Number of tiles in the body grid. */
  tiles?: number;
  /**
   * The finance card's body instead of a tile grid: a chart with this many
   * figures in a rail beside it, the first one the larger hero figure.
   */
  rail?: number;
  className?: string;
};

/**
 * Suspense fallback for one dashboard card. Mirrors the card chrome (title row
 * with an action on the right, then a tile grid) so the real card fills the
 * same box in place of the skeleton instead of shifting the grid.
 */
export function DashboardCardSkeleton({
  tiles = 3,
  rail,
  className,
}: DashboardCardSkeletonProps) {
  return (
    <Card className={cn("col-span-full", className)} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <CardAction>
          <Skeleton className="h-8 w-24" />
        </CardAction>
      </CardHeader>
      {rail ? (
        <RailBody figures={rail} />
      ) : (
        <CardContent>
          <div
            className={cn(
              "grid gap-3",
              tiles <= 2 && "grid-cols-1 sm:grid-cols-2",
              tiles === 3 && "grid-cols-1 sm:grid-cols-3",
              tiles >= 4 && "grid-cols-2 sm:grid-cols-5"
            )}
          >
            {Array.from({ length: tiles }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * The same grid as `DashboardFinanceCard`'s body, with each bar the height of
 * the line box it stands in for (a 14px eyebrow, a 28→32px hero figure, a
 * 24→28px figure), so the card swaps in without moving the chart.
 */
function RailBody({ figures }: { figures: number }) {
  return (
    <CardContent className="@container">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_14rem] @xl:grid-rows-[auto_1fr] @xl:gap-x-8">
        <div className="flex flex-col gap-1 @xl:col-start-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-7 w-36 sm:h-8" />
        </div>
        <Skeleton className="h-48 w-full sm:h-56 @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:h-auto @xl:min-h-72" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 @xl:col-start-2 @xl:grid-cols-1 @xl:self-end">
          {Array.from({ length: figures - 1 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-28 sm:h-7" />
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
}
