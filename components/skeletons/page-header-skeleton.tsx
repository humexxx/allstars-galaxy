import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PageHeaderSkeletonProps = {
  /** How many action buttons sit on the right of the real header. */
  actions?: number
  /** False for a header that is a title alone. */
  description?: boolean
  /** Width class for the description line; pages differ in how long theirs runs. */
  descriptionWidth?: string
  /** A description that runs to two lines on a phone. */
  descriptionWraps?: boolean
  /** Mirrors `PageHeader`'s `size`. */
  size?: "default" | "compact"
  /** Mirrors `PageHeader`'s `back` link. */
  back?: boolean
}

/**
 * The placeholder for `PageHeader`, sized to the real line boxes (h1 is 36px,
 * 40px from `sm`; the description 20px; the back link 36px on a phone) and
 * wrapping its actions as the real ones do, so the header does not grow when
 * the page swaps in.
 */
export function PageHeaderSkeleton({
  actions = 0,
  description = true,
  descriptionWidth = "w-72",
  descriptionWraps = false,
  size = "default",
  back = false,
}: PageHeaderSkeletonProps) {
  return (
    <div className="@container/page-header flex flex-col gap-2">
      {back && size === "default" && <Skeleton className="h-9 w-28 sm:h-8" />}
      <div
        className={cn(
          "flex flex-col gap-3 @2xl/page-header:flex-row @2xl/page-header:justify-between",
          size === "compact" ? "@2xl/page-header:items-center" : "@2xl/page-header:items-start"
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {back && size === "compact" && <Skeleton className="size-9 sm:size-8" />}
            <Skeleton
              className={cn(
                "w-48",
                size === "compact" ? "h-7 sm:h-8" : "h-9 sm:h-10"
              )}
            />
          </div>
          {description && (
            <Skeleton
              className={cn("max-w-full", descriptionWraps ? "h-10 sm:h-5" : "h-5", descriptionWidth)}
            />
          )}
        </div>
        {actions > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {Array.from({ length: actions }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-28" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
