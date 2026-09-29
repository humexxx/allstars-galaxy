import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/skeletons/page-header-skeleton"
import { cn } from "@/lib/utils"

/**
 * Mirrors `PlanForm`: three cards, not one flat form.
 *
 * The old version rendered `FormSkeleton rows={4}` — a single stack of four
 * inputs — while the real page is a 9-field two-column card plus Debt
 * acceleration and Auto-invest. The placeholder was about a third of the
 * final height, so the page lurched downwards on hydration.
 *
 * Keep the card count and the first card's fields in sync with
 * `components/finance/plan-form.tsx`.
 */
function FieldPair({
  className,
  controlClassName = "h-10",
}: {
  className?: string
  controlClassName?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className={cn("w-full", controlClassName)} />
    </div>
  )
}

/** A label + description on the left, a switch on the right, in a tile. */
function ToggleRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3",
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="h-5 w-9 rounded-full" />
    </div>
  )
}

function SliderBlock() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

function FormCard({
  children,
  titleWidth,
  description = false,
}: {
  children: React.ReactNode
  titleWidth: string
  description?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={cn("h-6", titleWidth)} />
        {description && <Skeleton className="h-4 w-full max-w-lg" />}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  )
}

export default function NewPlanLoading() {
  return (
    <section className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <PageHeaderSkeleton descriptionWidth="w-96" />

      {/* Plan basics — two-column grid of name, description, dates, savings… */}
      <FormCard titleWidth="w-28">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldPair className="sm:col-span-2" />
          <FieldPair className="sm:col-span-2" controlClassName="h-16" />
          {Array.from({ length: 4 }).map((_, i) => (
            <FieldPair key={i} />
          ))}
          <FieldPair className="sm:col-span-2" controlClassName="h-7 w-44" />
          <ToggleRow className="sm:col-span-2" />
          <FieldPair className="sm:col-span-2" />
        </div>
      </FormCard>

      {/* Debt acceleration — toggle, aggressiveness slider, payoff method */}
      <FormCard titleWidth="w-40" description>
        <ToggleRow />
        <SliderBlock />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </FormCard>

      {/* Auto-invest — toggle, share slider, method picker, initial balance */}
      <FormCard titleWidth="w-32" description>
        <ToggleRow />
        <SliderBlock />
        <FieldPair />
        <FieldPair />
      </FormCard>

      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-28" />
      </div>
    </section>
  )
}
