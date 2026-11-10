import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/**
 * Mirrors the PlansWorkspace silhouette: page header with its action, then the
 * hero grid — the projection-comparison card across 2/3 and the plan rail on
 * the right third. A generic four-card grid made the swap to the real layout
 * read as a jump rather than content filling in.
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
      {/* PageHeader: the title on the left, "New plan" on the right */}
      <PageHeaderSkeleton actions={1} description={false} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Projection comparison */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            {/* "Net worth" and the figure with its change chip */}
            <div className="flex flex-col gap-1">
              {/* The eyebrow row is h-5, like the real one */}
              <div className="flex h-5 items-center">
                <Skeleton className="h-3 w-16" />
              </div>
              {/* The chip drops under the figure where both do not fit */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Skeleton className="h-9 w-44 sm:h-10 sm:w-54" />
                <Skeleton className="h-5 w-44 rounded-full" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* horizon select, 36px on a phone */}
              <Skeleton className="h-9 w-38 sm:h-8" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Skeleton className="h-64 w-full sm:h-80 lg:h-115" />
          </CardContent>
        </Card>

        {/* Your plans rail */}
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="my-0.5 h-3 w-24" />
            {/* The hint takes two lines in a narrow rail: a phone, and from lg */}
            <div className="flex flex-col">
              <Skeleton className="my-0.5 h-4 w-full" />
              <Skeleton className="my-0.5 h-4 w-2/3 sm:max-lg:hidden" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {/* A row: name, net worth at the end, its date, the debt-free line.
                In a narrow rail the last two wrap. */}
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-23.5 w-full rounded-lg sm:h-19.5 lg:h-27.5" />
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
