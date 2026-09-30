import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PageHeaderSkeletonProps = {
  /** How many action buttons sit on the right of the real header. */
  actions?: number
  /** Width class for the description line; pages differ in how long theirs runs. */
  descriptionWidth?: string
  /** Mirrors `PageHeader`'s `size`. */
  size?: "default" | "compact"
  /** Mirrors `PageHeader`'s `back` link. */
  back?: boolean
}

/**
 * The placeholder for `PageHeader`, sized to the real line boxes (h1 is 36px,
 * 40px from `sm`; the description 20px) so the header does not grow when the
 * page swaps in.
 */
export function PageHeaderSkeleton({
  actions = 0,
  descriptionWidth = "w-72",
  size = "default",
  back = false,
}: PageHeaderSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {back && <Skeleton className="h-8 w-28" />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton
            className={cn(
              "w-48",
              size === "compact" ? "h-7 sm:h-8" : "h-9 sm:h-10"
            )}
          />
          <Skeleton className={cn("h-5 max-w-full", descriptionWidth)} />
        </div>
        {actions > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {Array.from({ length: actions }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
