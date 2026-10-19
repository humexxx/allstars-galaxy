import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors `RoadPathDetail` under its `PageHeader` (with the back link). */
export function RoadPathDetailSkeleton() {
  return (
    <>
      <PageHeaderSkeleton back descriptionWidth="w-64" />
      {/* The same container breakpoints as the detail, so nothing jumps. */}
      <div className="@container flex flex-col gap-6" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-7 w-20 sm:h-8" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-56" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-8 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </>
  );
}
