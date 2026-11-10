import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function FieldSkeleton({ label, control = "h-10" }: { label: string; control?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn("h-4.75", label)} />
      <Skeleton className={cn("w-full", control)} />
    </div>
  );
}

/**
 * `TripForm` before it loads, in the form's own grid: the four text fields
 * beside the cover picker from `md` (the dates side by side where their column
 * has room), then the colour swatches, the notes and the two buttons.
 */
export function TripFormSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="@container flex flex-col gap-4">
          <FieldSkeleton label="w-10" />
          <FieldSkeleton label="w-24" />
          <div className="grid gap-3 @sm:grid-cols-2">
            <FieldSkeleton label="w-10" />
            <FieldSkeleton label="w-10" />
          </div>
          <FieldSkeleton label="w-20" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-29 w-full rounded-lg md:h-27" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-10" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="size-9 rounded-full sm:size-7" />
          ))}
        </div>
      </div>
      <FieldSkeleton label="w-12" control="h-16" />
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-19" />
        <Skeleton className="h-10 w-26" />
      </div>
    </div>
  );
}
