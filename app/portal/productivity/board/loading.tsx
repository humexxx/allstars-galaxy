import { ChevronLeft, ChevronRight, Maximize2, Plus } from "lucide-react"

import { PageHeader } from "@/components/portal/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Mirrors `BoardView`. Everything that is the same on every board is drawn
 * as it will be — the title, its buttons (disabled until the board is
 * there), the day arrows, the column frames with the strip their header
 * takes — and only the cards inside the frames pulse. Pulsing bars for the
 * title and the column names read as more things loading than there are.
 */
export default function BoardLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6" aria-busy="true">
      <PageHeader
        title="Task board"
        actions={
          <>
            <Button variant="ghost" size="icon" className="hidden md:inline-flex" disabled tabIndex={-1} aria-label="Expand board">
              <Maximize2 />
            </Button>
            <Button disabled tabIndex={-1}>
              <Plus />
              Add task
            </Button>
            <Button variant="outline" disabled tabIndex={-1}>
              <Plus />
              Add column
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-1" aria-hidden="true">
        <Button variant="outline" size="icon-sm" disabled tabIndex={-1}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" disabled tabIndex={-1}>
          <ChevronRight />
        </Button>
      </div>
      <div className="-mx-1 flex min-h-0 flex-1 gap-3 overflow-hidden px-1 pb-2" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="flex min-w-72 flex-1 flex-col rounded-xl border bg-muted/30">
            {/* The height of the real header row: py-3 around 32px buttons. */}
            <div className="h-14 shrink-0" />
            <div className="flex flex-col gap-2 px-2 pb-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
