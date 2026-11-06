import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/**
 * Mirrors the PlanEditor silhouette: the compact PageHeader (back link, title,
 * tabs + More) and the Polymarket-style Overview hero — a 3/4 main panel
 * (net worth today with its change chip, the view switcher over the horizon
 * presets, then the default Graph view) beside the 1/4 sidebar: the gauge and
 * figures card, then the Portfolio card (from xl; below it the sidebar cards
 * sit under the panel, two abreast from lg). Matching spacing + breakpoints
 * keeps the swap to the real editor a content fill-in, not a layout shift.
 */
export default function PlanDetailLoading() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading plan…
      </span>
      <PageHeaderSkeleton back size="compact" actions={2} descriptionWidth="w-96" />

      {/* Overview hero: 3/4 main panel + 1/4 sidebar (stacked on mobile). */}
      <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        {/* Graph view card — fixed panel height on lg (ProjectionPanel's
            xl:h-160 view box) */}
        <Card className="min-w-0 xl:col-span-3 xl:h-160">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              {/* "Today", the figure with its change chip, the owed note */}
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-20" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-52 sm:h-10 sm:w-60" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
              {/* View switcher over the horizon presets, both h-8 */}
              <div className="flex flex-col items-end gap-2">
                <Skeleton className="h-8 w-28 sm:w-56" />
                <Skeleton className="h-8 w-52" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="xl:min-h-0 xl:flex-1">
            <Skeleton className="h-72 w-full sm:h-80 xl:h-full" />
          </CardContent>
        </Card>

        {/* Sidebar: figures card (gauge + rows, stretches) + Portfolio card */}
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 xl:flex xl:min-h-160 xl:flex-col xl:items-stretch xl:gap-4">
          <Card className="xl:flex-1">
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-30 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div>
                {/* Income, expenses, debt, owed to you, surplus */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 border-t py-2.5"
                  >
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <Skeleton className="h-3 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {/* Today, in 12 months, then the "Count in net worth" switch */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
