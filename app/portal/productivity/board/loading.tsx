import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors `BoardView`: header with three actions, then the column rail. */
export default function BoardLoading() {
  return (
    <>
      <PageHeaderSkeleton actions={3} descriptionWidth="w-64" />
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, col) => (
          <div
            key={col}
            className="flex min-w-72 flex-1 flex-col gap-2 rounded-xl border bg-muted/30 p-2"
          >
            <Skeleton className="mx-2 my-2 h-6 w-28" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </>
  )
}
