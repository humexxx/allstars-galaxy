import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardCardSkeletonProps = {
  /**
   * The finance card's body: this many figures in a column beside the chart,
   * the first one the larger net-worth figure.
   */
  rail?: number;
  /** The travel card's body: its featured trip tiles. */
  trips?: boolean;
  /** The productivity card's body: today's board beside the habits. */
  board?: boolean;
  className?: string;
};

/**
 * Suspense fallback for the finance, productivity and travel dashboard cards.
 * Every bar is the height of the line box it stands in for — the title is a
 * 24→28px line, the description a 20px one, the action 36px on a phone — and
 * text that wraps is drawn as pieces of its width in a wrapping row, so the
 * bars break onto a second line where the words do. The real card then fills
 * the same box instead of pushing the grid down when it lands. Sport cards
 * have their own (`DashboardSportCardSkeleton`): they share row tracks in
 * pairs.
 */
export function DashboardCardSkeleton({
  rail,
  trips,
  board,
  className,
}: DashboardCardSkeletonProps) {
  return (
    <Card className={cn("col-span-full", className)} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-6 w-40 sm:h-7" />
        {/* The finance card's header is its plan name alone. */}
        {!rail && <Skeleton className="h-5 w-40 max-w-full" />}
        <CardAction>
          <Skeleton className="h-9 w-20 sm:h-8" />
        </CardAction>
      </CardHeader>
      {rail ? <RailBody figures={rail} /> : null}
      {trips ? <TripsBody /> : null}
      {board ? <BoardBody /> : null}
    </Card>
  );
}

/**
 * The same grid as `DashboardFinanceCard`'s body — figures in a 15rem column,
 * the chart beside it from `@2xl` — with each bar the height of the line box
 * it stands in for (net worth's 36→40px figure, then an eyebrow, 14px and 16px
 * on a phone, over a 20→24px figure per part), so the card swaps in without
 * moving the chart. A part's note is not drawn: which parts have one is data.
 */
function RailBody({ figures }: { figures: number }) {
  return (
    <CardContent className="@container">
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-[15rem_minmax(0,1fr)] @2xl:gap-x-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3.5 w-20 max-sm:h-4" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-9 w-44 sm:h-10" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-1">
            {Array.from({ length: figures - 1 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-20 max-sm:h-4" />
                <Skeleton className="h-5 w-24 sm:h-6" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-64 w-full sm:h-72 @2xl:h-auto @2xl:min-h-96" />
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

/**
 * `DashboardProductivityCard`'s two panels, in its grid: today's board (label,
 * progress bar, task lines) and the habits, each a name over its day with the
 * week's dots beside it — under it where the panel is too narrow, as the real
 * row wraps.
 */
function BoardBody() {
  return (
    <CardContent className="@container">
      <div className="grid gap-3 @2xl:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-1.5 w-full" />
          <div className="flex flex-col gap-2">
            {["w-48", "w-56"].map((width, i) => (
              <Skeleton key={i} className={cn("h-6 max-w-full", width)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-col">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-9.5 w-54 max-sm:h-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardContent>
  );
}
