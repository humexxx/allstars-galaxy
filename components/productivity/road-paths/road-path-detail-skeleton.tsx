import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors `RoadPathDetail` under its `PageHeader` (with the back link): two figures, then the calendar. */
export function RoadPathDetailSkeleton() {
  return (
    <>
      <PageHeaderSkeleton back descriptionWidth="w-64" />
      <div className="@container flex flex-col gap-6" aria-hidden="true">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
