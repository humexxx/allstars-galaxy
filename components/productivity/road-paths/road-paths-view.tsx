import { RoadPathCard } from "./road-path-card";
import type { RoadPath } from "@/types";

type RoadPathsViewProps = {
  roadPaths: RoadPath[];
  /** Today in the reader's zone (`YYYY-MM-DD`), for "past its target". */
  today?: string;
};

/** The grid of road paths. Each card links to its own `?path=` detail. */
export function RoadPathsView({ roadPaths, today }: RoadPathsViewProps) {
  return (
    // Columns by the room the grid has: from `md` the sidebar takes 256px,
    // and the viewport breakpoints made two 220px cards with their titles
    // three words to a line.
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {roadPaths.map((path) => (
          <RoadPathCard key={path.id} roadPath={path} today={today} />
        ))}
      </div>
    </div>
  );
}
