import { Skeleton } from "@/components/ui/skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

export default function MoreAppsLoading() {
  return (
    <PortalPageContainer>
      <section className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
      </section>
    </PortalPageContainer>
  )
}
