import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the road-paths grid: header with one action, then the cards. */
export default function RoadPathsLoading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} descriptionWidth="w-72" />
      <div className="@container" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </>
  )
}
