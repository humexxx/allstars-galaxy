import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the app cards: preview, title and blurb, badges, the Open button. */
export default function MoreAppsLoading() {
  return (
    <PortalPageContainer>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="pt-0">
            <Skeleton className="aspect-video w-full rounded-none" />
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
    </PortalPageContainer>
  )
}
