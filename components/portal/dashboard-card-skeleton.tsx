import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardCardSkeletonProps = {
  /** Number of tiles in the body grid. */
  tiles?: number;
  /** Whether a chart-shaped block follows the tiles. */
  chart?: boolean;
  className?: string;
};

/**
 * Suspense fallback for one dashboard card. Mirrors the card chrome (title row
 * with an action on the right, then a tile grid) so the real card fills the
 * same box in place of the skeleton instead of shifting the grid.
 */
export function DashboardCardSkeleton({
  tiles = 3,
  chart = false,
  className,
}: DashboardCardSkeletonProps) {
  return (
    <Card className={cn("col-span-full", className)} aria-hidden="true">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "grid gap-3",
            tiles <= 2 && "grid-cols-1 sm:grid-cols-2",
            tiles === 3 && "grid-cols-1 sm:grid-cols-3",
            tiles >= 4 && "grid-cols-2 sm:grid-cols-5"
          )}
        >
          {Array.from({ length: tiles }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
        {chart && <Skeleton className="h-36 w-full" />}
      </CardContent>
    </Card>
  );
}
