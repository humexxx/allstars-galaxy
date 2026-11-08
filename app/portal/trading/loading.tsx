import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton";

/** The journal's silhouette: header, the balance card, the tabs and a month. */
export default function TradingJournalLoading(): React.ReactElement {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading the journal…
      </span>
      <PageHeaderSkeleton actions={3} descriptionWidth="w-80" />
      <Card>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 xl:grid-cols-4">
        <Skeleton className="h-120 xl:col-span-3" />
        <Skeleton className="h-64" />
      </div>
    </section>
  );
}
