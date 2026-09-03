import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shared trip is the one page strangers land on cold, so the shell paints
 * before the trip resolves: the cover, the title block and the first rows of
 * the plan.
 */
export default function PublicTripLoading() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Skeleton className="aspect-[21/9] w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
