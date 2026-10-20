import {
  SPORT_CARD_HEADER,
  SPORT_CARD_ROWS,
  SPORT_CARD_SECTION,
} from "@/components/entertainment/sports/shared/dashboard-card-rows";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/*
 * One placeholder per dashboard card, each laid out like the card it stands in
 * for and every bar the height of the line box it replaces, so a card swaps in
 * without moving the ones below it. A generic "title and a few tiles" box was
 * 80px short of the travel card and 400px short of a sport card, and the page
 * jumped as each one arrived.
 */

/**
 * The header every dashboard card shares: a 24→28px title, a 20px description
 * and the outline "Open" button. `description` is the bars of that line, which
 * wrap on a phone the way the words do.
 */
function HeaderSkeleton({
  titleWidth = "w-40",
  description = ["w-48"],
  className,
}: {
  titleWidth?: string;
  description?: string[];
  className?: string;
}) {
  return (
    <CardHeader className={className}>
      <Skeleton className={cn("h-6 max-w-full sm:h-7", titleWidth)} />
      {/* 2px between wrapped bars: the badge sits 4px under the text it
          wraps from, and two lines of text have no gap at all. */}
      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
        {description.map((width, i) => (
          <Skeleton key={i} className={cn("h-5 max-w-full", width)} />
        ))}
      </div>
      <CardAction>
        <Skeleton className="h-8 w-20" />
      </CardAction>
    </CardHeader>
  );
}

/**
 * `DashboardFinanceCard`: the projection line and its badge in the header,
 * then the chart beside a rail of figures (net worth first) once the card is
 * wide, or net worth, the chart and a 2×2 breakdown on a phone.
 */
export function DashboardFinanceSkeleton() {
  return (
    <Card className="col-span-full" aria-hidden="true">
      <HeaderSkeleton description={["w-44", "w-36", "w-32 rounded-full"]} />
      <CardContent className="@container">
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_14rem] @xl:grid-rows-[auto_1fr] @xl:gap-x-8">
          <div className="flex flex-col gap-1 @xl:col-start-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-48 w-full sm:h-56 @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:h-auto @xl:min-h-72" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 @xl:col-start-2 @xl:grid-cols-1 @xl:self-end">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-28" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * `DashboardTravelCard`: two trip tiles side by side once the card is `@3xl`
 * wide, only the first on a phone. Each tile is a cover beside its details
 * from `@sm`, the cover on top below it; the details' metadata is a row of
 * short bars that wraps as the destination, dates, items and price do.
 */
export function DashboardTravelSkeleton() {
  return (
    <Card className="col-span-full" aria-hidden="true">
      <HeaderSkeleton titleWidth="w-36" description={["w-32"]} />
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
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-5 w-40 max-w-full sm:h-6" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A labelled list of 36px rows — a match line or a table row: the striped
 * row, a crest, a name and a figure.
 */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-20" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex h-9 items-center gap-2 rounded-md px-1.5 odd:bg-muted/40">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="ml-auto h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A sport card (`DashboardSportCard`, `DashboardF1Card`): the header, the boxed
 * lead, a list and a table — the same four rows, so beside a card that has
 * already arrived it takes its share of the row tracks they lay out together
 * (`dashboard-card-rows.ts`) instead of its own height.
 */
export function DashboardSportSkeleton() {
  return (
    <Card className={SPORT_CARD_ROWS} aria-hidden="true">
      <HeaderSkeleton
        className={SPORT_CARD_HEADER}
        titleWidth="w-32"
        description={["w-44"]}
      />
      <div className={SPORT_CARD_SECTION}>
        {/* The `FeatureBox` frame: a label and a status over two lines. */}
        <div className="flex h-full min-h-28 flex-col gap-2 rounded-lg border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      </div>
      <div className={SPORT_CARD_SECTION}>
        <RowsSkeleton rows={3} />
      </div>
      <div className={SPORT_CARD_SECTION}>
        <RowsSkeleton rows={4} />
      </div>
    </Card>
  );
}

/**
 * The sport cards before the favourites are known: two, the most a row holds.
 * Fewer real cards just leave the row shorter.
 */
export function DashboardSportsSkeleton() {
  return (
    <>
      <DashboardSportSkeleton />
      <DashboardSportSkeleton />
    </>
  );
}
