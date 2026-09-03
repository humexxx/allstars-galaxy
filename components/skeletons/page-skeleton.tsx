import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"

/**
 * Generic page skeleton used by `loading.tsx` boundaries across the portal.
 * Renders a header + a grid of card-shaped blocks that match the typical
 * portal page silhouette. Modules can compose their own variant when the
 * default doesn't match closely enough.
 */
export function PageSkeleton({
  cards = 3,
  cardHeight = "h-32",
}: {
  cards?: number
  cardHeight?: string
}) {
  return (
    <section className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className={`${cardHeight} w-full`} />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </section>
  )
}
