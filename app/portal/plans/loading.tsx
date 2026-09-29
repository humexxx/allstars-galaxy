import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/**
 * Mirrors the PlansWorkspace silhouette: page header with its action, then the
 * hero grid — the projection-comparison card across 2/3 and the plan rail on
 * the right third. The generic PageSkeleton promised a four-card grid, so the
 * swap to the real layout read as a jump rather than content filling in.
 *
 * Keep the grid, the chart height and the rail row height in sync with
 * `components/finance/plans-workspace.tsx`.
 */
export default function PlansLoading() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading plans…
      </span>
      {/* PageHeader: title + description on the left, "New plan" on the right */}
      <PageHeaderSkeleton actions={1} descriptionWidth="w-80" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Projection comparison */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-6 w-44" />
            <div className="flex flex-wrap items-center gap-2">
              {/* horizon select + metric toggle, both h-8 */}
              <Skeleton className="h-8 w-38" />
              <Skeleton className="h-8 w-44" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Skeleton className="h-64 w-full sm:h-80 lg:h-115" />
          </CardContent>
        </Card>

        {/* Your plans rail */}
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
