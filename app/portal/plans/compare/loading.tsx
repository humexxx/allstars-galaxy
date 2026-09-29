import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/**
 * Mirrors the real Compare screen: header (with its back link), then the two
 * cards `CompareView` renders — the plan selector (a row of wrapping chips)
 * and the projection chart. The per-plan ending-state card sits below the
 * fold, so it is left out.
 */
export default function ComparePlansLoading() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeaderSkeleton back descriptionWidth="w-80" />

      {/* Selector card — one chip per plan */}
      <Card>
        <CardHeader>
          <Skeleton className="h-3 w-28" />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-36 rounded-lg" />
          ))}
        </CardContent>
      </Card>

      {/* Chart card — title left, metric toggle right */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </section>
  )
}
