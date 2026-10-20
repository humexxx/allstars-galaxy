import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardCardSkeletonProps = {
  /**
   * The finance card's body: a chart with this many figures in a rail beside
   * it, the first one the larger hero figure.
   */
  rail?: number;
  /** The travel card's body: its featured trip tiles. */
  trips?: boolean;
  className?: string;
};

/**
 * Suspense fallback for the finance and travel dashboard cards. Every bar is
 * the height of the line box it stands in for — the title is a 24→28px line,
 * the description a 20px one — and text that wraps is drawn as pieces of its
 * width in a wrapping row, so the bars break onto a second line where the
 * words do. The real card then fills the same box instead of pushing the grid
 * down when it lands. Sport cards have their own
 * (`DashboardSportCardSkeleton`): they share row tracks in pairs.
 */
export function DashboardCardSkeleton({
  rail,
  trips,
  className,
}: DashboardCardSkeletonProps) {
  return (
    <Card className={cn("col-span-full", className)} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-6 w-40 sm:h-7" />
        {rail ? (
          // "12-month projection · updated <day>", which wraps as text (no gap
          // between its lines), then the change badge. Flex bases, not widths:
          // a fixed-width bar sets the header column's minimum and pushes the
          // action off a phone-width card.
          <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
            <div className="flex min-w-0 shrink basis-71 flex-wrap gap-x-1">
              <Skeleton className="h-5 min-w-0 shrink basis-40" />
              <Skeleton className="h-5 min-w-0 shrink basis-30" />
            </div>
            <Skeleton className="h-5 min-w-0 shrink basis-44" />
          </div>
        ) : (
          <Skeleton className="h-5 w-40 max-w-full" />
        )}
        <CardAction>
          <Skeleton className="h-8 w-20" />
        </CardAction>
      </CardHeader>
      {rail ? <RailBody figures={rail} /> : null}
      {trips ? <TripsBody /> : null}
    </Card>
  );
}

/**
 * The same grid as `DashboardFinanceCard`'s body, with each bar the height of
 * the line box it stands in for (a 14px eyebrow over a 28px figure), so the
 * card swaps in without moving the chart.
 */
function RailBody({ figures }: { figures: number }) {
  return (
    <CardContent className="@container">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_14rem] @xl:grid-rows-[auto_1fr] @xl:gap-x-8">
        <div className="flex flex-col gap-1 @xl:col-start-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="h-48 w-full sm:h-56 @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:h-auto @xl:min-h-72" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 @xl:col-start-2 @xl:grid-cols-1 @xl:self-end">
          {Array.from({ length: figures - 1 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
}

/**
 * `DashboardTravelCard`'s tiles: the same grid and the same tile (cover beside
 * the text from `@sm`, at least 140px tall; above it on a phone), with the
 * badge and title as bars and the details row as its four pieces —
 * destination, dates, items, total — wrapping like the real one.
 */
function TripsBody() {
  return (
    <CardContent className="@container">
      <div className="grid gap-3 @3xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={cn(
              "@container overflow-hidden rounded-lg border",
              i > 0 && "hidden @3xl:block"
            )}
          >
            <div className="grid @sm:grid-cols-[9rem_1fr] @xl:grid-cols-[12.5rem_1fr]">
              <Skeleton className="aspect-video rounded-none @sm:aspect-auto @sm:h-full @sm:min-h-35" />
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-40 sm:h-6" />
                <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
                  <Skeleton className="h-4 min-w-0 shrink basis-56" />
                  <Skeleton className="h-4 min-w-0 shrink basis-36" />
                  <Skeleton className="h-4 min-w-0 shrink basis-18" />
                  <Skeleton className="h-4 min-w-0 shrink basis-11" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  );
}
