import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/**
 * Mirrors the PlanEditor silhouette: the compact PageHeader (back link, title,
 * tabs + More) and the Polymarket-style Overview hero — a 3/4 main panel
 * (forecast header with its control cluster + the default Graph view) beside
 * the 1/4 gauge / figures / strategy sidebar. Matching spacing + breakpoints
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
      <div className="grid gap-4 lg:grid-cols-4 lg:items-start">
        {/* Graph view card — fixed panel height on lg (ProjectionPanel's
            lg:h-160 view box) */}
        <Card className="min-w-0 lg:col-span-3 lg:h-160">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              {/* KPIs: Today / Next / End */}
              <div className="flex items-end gap-6">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-28 sm:h-8" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
              {/* View switcher, confirm, portfolio, horizon — all h-8 */}
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-28 sm:w-56" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-44" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="lg:min-h-0 lg:flex-1">
            <Skeleton className="h-72 w-full sm:h-80 lg:h-full" />
          </CardContent>
        </Card>

        {/* Sidebar: figures card (gauge + rows, stretches) + debt strategy */}
        <div className="flex min-w-0 flex-col gap-3 lg:h-160 lg:gap-4">
          <Card className="lg:flex-1">
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <Skeleton className="size-30 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div>
                {Array.from({ length: 4 }).map((_, i) => (
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
          <Card>
            <CardHeader>
              <Skeleton className="h-3 w-28" />
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-13 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
