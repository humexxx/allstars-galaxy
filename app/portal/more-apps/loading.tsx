import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the app cards: preview, title and blurb, badges, the Open button. */
export default function MoreAppsLoading() {
  return (
    <PortalPageContainer>
      <PageHeaderSkeleton />
      <div className="@container" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="pt-0">
            <Skeleton className="aspect-5/2 w-full rounded-none sm:aspect-video" />
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </PortalPageContainer>
  )
}
