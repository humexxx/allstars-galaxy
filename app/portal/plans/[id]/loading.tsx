import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/**
 * Mirrors the PlanEditor silhouette: the compact PageHeader (back link, title,
 * tabs + More) and the Polymarket-style Overview hero — a 3/4 main panel
 * (net worth today with its change chip, the view switcher over the horizon
 * presets, then the default Graph view) beside the 1/4 sidebar: the gauge and
 * figures card, then the Portfolio and Trading cards (from xl; below it the
 * sidebar cards sit under the panel, two abreast from lg). Matching spacing +
 * breakpoints keeps the swap to the real editor a content fill-in, not a
 * layout shift.
 *
 * `text-2xs` lines (the eyebrow, the owed note, the gauge label) are 14px tall
 * and 16px on a phone, where the two switchers are also 40px instead of 32.
 */
export default function PlanDetailLoading() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading plan…
      </span>
      {/* No line under the title: the current period sits beside it and the
          plan's description is in a tooltip. */}
      <PageHeaderSkeleton back size="compact" actions={2} description={false} />

      {/* Overview hero: 3/4 main panel + 1/4 sidebar (stacked on mobile). */}
      <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        {/* Graph view card — fixed panel height on lg (ProjectionPanel's
            screen-tall view box) */}
        <Card className="min-w-0 xl:col-span-3 xl:h-[max(40rem,calc(100svh-11.5rem))]">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              {/* "Today", the figure with its change chip, the owed note */}
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-20 max-sm:h-4" />
                {/* The chip drops under the figure where both do not fit */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Skeleton className="h-9 w-44 sm:h-10 sm:w-54" />
                  <Skeleton className="h-5 w-44 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-36 max-sm:h-4" />
              </div>
              {/* View switcher over the horizon presets */}
              <div className="flex flex-col gap-2 sm:items-end">
                <Skeleton className="h-10 w-40 sm:h-8 sm:w-68" />
                <Skeleton className="h-10 w-54 sm:h-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="xl:min-h-0 xl:flex-1">
            <Skeleton className="h-72 w-full sm:h-80 xl:h-full" />
          </CardContent>
        </Card>

        {/* Sidebar: figures card (gauge + rows, stretches), then Portfolio and
            Trading */}
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 xl:flex xl:min-h-[max(40rem,calc(100svh-11.5rem))] xl:flex-col xl:items-stretch xl:gap-4">
          <Card className="xl:flex-1">
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-30 rounded-full" />
                <Skeleton className="h-3.5 w-24 max-sm:h-4" />
              </div>
              <div>
                {/* Income, expenses, debt over its debt-free line, owed to you */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-x-3 border-t py-2.5"
                  >
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                    {i === 2 && (
                      <div className="flex basis-full justify-end">
                        <Skeleton className="h-3.5 w-28 max-sm:h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {/* Portfolio, Trading: the name beside its link, today, the horizon */}
          {Array.from({ length: 2 }).map((_, card) => (
            <Card key={card} className="gap-3">
              <CardHeader className="flex h-6 items-center justify-between gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
