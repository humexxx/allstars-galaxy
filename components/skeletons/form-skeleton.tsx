import { Skeleton } from "@/components/ui/skeleton"

/**
 * Generic form skeleton sized to roughly match an auth / single-card form.
 * Used as the Suspense fallback for client-form pages so the user sees a
 * placeholder while the form bundle hydrates.
 */
export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
