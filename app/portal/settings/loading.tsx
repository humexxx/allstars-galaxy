import { PortalPageContainer } from "@/components/portal/page-container"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors the settings page: the category rail, then the Appearance pane —
 * one setting (its label over a description that wraps on a phone, the switch
 * beside it) and the mascot preview under it.
 */
export default function SettingsLoading() {
  return (
    <PortalPageContainer>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6" aria-hidden="true">
        <div className="flex gap-1.5 pb-1 lg:w-52 lg:shrink-0 lg:flex-col lg:pb-0">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-11.5 w-36 rounded-lg lg:w-full" />
          ))}
        </div>
        <Card className="w-full min-w-0 lg:flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-32 sm:h-7" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-13 w-full max-w-lg sm:h-5" />
              </div>
              <Skeleton className="h-6 w-10 shrink-0 rounded-full" />
            </div>
            <Skeleton className="h-42 w-full rounded-lg sm:h-46" />
          </CardContent>
        </Card>
      </div>
    </PortalPageContainer>
  )
}
