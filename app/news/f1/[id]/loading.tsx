import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the article silhouette: eyebrow, headline, dateline, the 16:9 hero,
 * the summary paragraph and the button to the source.
 */
export default function F1ArticleLoading() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-full max-w-2xl sm:h-10" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="flex max-w-2xl flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-9 w-44" />
    </div>
  );
}
