import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the sports hub: header, the sport strip, then one sport's shell. */
export default function SportsLoading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} descriptionWidth="w-full max-w-2xl" />
      <div className="flex flex-col gap-6" aria-hidden="true">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-40 sm:h-8" />
            <Skeleton className="h-5 w-56" />
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
