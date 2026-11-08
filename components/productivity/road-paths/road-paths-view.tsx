"use client";

import { useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { reorderRoadPathsAction } from "@/app/actions/road-path";
import { cn } from "@/lib/utils";
import type { RoadPathWithCheckIns } from "@/types";

import { RoadPathCard } from "./road-path-card";

/** A faint square grid in the tone of the charts' gridlines (the border colour, thinned). */
const GRID_LINE = "color-mix(in oklab, var(--border) 70%, transparent)";
const GRID: React.CSSProperties = {
  backgroundImage: `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
  backgroundSize: "2rem 2rem",
};

type RoadPathsViewProps = {
  roadPaths: RoadPathWithCheckIns[];
  /** Today in the reader's zone (`YYYY-MM-DD`). */
  today: string;
  /** The reader's IANA zone. */
  timeZone?: string;
};

/**
 * The grid of road paths, in the order the user dragged them into. A card
 * moves once the pointer travels 8px, so a plain click still opens its
 * `?path=` detail; the keyboard moves a focused card with space and the
 * arrows. The new order shows at once and is saved behind it.
 */
export function RoadPathsView({ roadPaths, today, timeZone }: RoadPathsViewProps) {
  // The order the server sent, until a drag says otherwise. A new list from
  // the server (after the save, a new path, a delete) replaces it.
  const serverKey = roadPaths.map((p) => p.id).join();
  const [local, setLocal] = useState<{ key: string; ids: string[] } | null>(null);
  const ids = local?.key === serverKey ? local.ids : roadPaths.map((p) => p.id);
  const byId = new Map(roadPaths.map((p) => [p.id, p]));
  // A drag ends on the card's link; the click that follows must not open it.
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocal({ key: serverKey, ids: next });
    void reorderRoadPathsAction({ ids: next }).then((result) => {
      if (!result.success) {
        toast.error("Could not save the new order");
        setLocal(null);
      }
    });
  };

  return (
    // Columns by the room the grid has: from `lg` the sidebar takes 192px,
    // and viewport breakpoints made two narrow cards with their titles three
    // words to a line. It fills the rest of the page, over a faint grid that
    // fades out towards the bottom and the sides.
    <div className="@container relative flex-1">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 mask-x-from-90% mask-b-from-30%"
        style={GRID}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            className="relative grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3"
            onClickCapture={(e) => {
              if (!justDragged.current) return;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {ids.map((id) => {
              const path = byId.get(id);
              return path ? (
                <SortableCard key={id} id={id} title={path.title}>
                  <RoadPathCard roadPath={path} today={today} timeZone={timeZone} />
                </SortableCard>
              ) : null;
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`Move ${title}`}
      className={cn(
        "cursor-grab touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "relative z-10 opacity-90 shadow-lg"
      )}
    >
      {children}
    </div>
  );
}
