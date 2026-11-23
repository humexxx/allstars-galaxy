import { PortalPageContainer } from "@/components/portal/page-container";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the calculator: the form card, and the result card beside it from a wide column. */
export default function CaloriesLoading(): React.ReactElement {
  return (
    <PortalPageContainer>
      <PageHeaderSkeleton descriptionWidth="w-96 max-w-full" descriptionWraps />
      <div className="@container" aria-hidden="true">
        <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-5">
          <Card className="@4xl:col-span-3">
            <CardHeader>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-5 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="flex flex-col gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-36" />
                <div className="grid gap-2 @xl:grid-cols-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="@4xl:col-span-2">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-6">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-40" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalPageContainer>
  );
}
