import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the settings page: header, the category rail, then one pane. */
export default function SettingsLoading() {
  return (
    <PortalPageContainer>
      <PageHeaderSkeleton descriptionWidth="w-80" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6" aria-hidden="true">
        <div className="flex gap-1.5 sm:w-52 sm:shrink-0 sm:flex-col">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-36 rounded-lg sm:w-full" />
          ))}
        </div>
        <Card className="w-full min-w-0 sm:flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
      </div>
    </PortalPageContainer>
  )
}
