import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The trip list: header with its "New trip" button, the Upcoming/Calendar
 * switch, then a grid of cover cards — the silhouette the page swaps into.
 */
export default function TravelPlannerLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <PageHeaderSkeleton actions={1} descriptionWidth="w-96" />
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="pt-0">
            <Skeleton className="aspect-video w-full rounded-none" />
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
