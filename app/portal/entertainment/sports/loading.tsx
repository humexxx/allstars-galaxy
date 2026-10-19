import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { SportSkeleton } from "@/components/entertainment/sports/sports-navigation"

/** Mirrors the sports hub: header, the sport strip, then one sport's shell. */
export default function SportsLoading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} description={false} />
      <div className="flex flex-col gap-6" aria-hidden="true">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <SportSkeleton />
      </div>
    </>
  )
}
