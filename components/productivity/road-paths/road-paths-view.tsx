import { RoadPathCard } from "./road-path-card";
import type { RoadPathWithCheckIns } from "@/types";

type RoadPathsViewProps = {
  roadPaths: RoadPathWithCheckIns[];
  /** Today in the reader's zone (`YYYY-MM-DD`). */
  today: string;
  /** The reader's IANA zone. */
  timeZone?: string;
};

/** The grid of road paths. Each card links to its own `?path=` detail. */
export function RoadPathsView({ roadPaths, today, timeZone }: RoadPathsViewProps) {
  return (
    // Columns by the room the grid has: from `md` the sidebar takes 192px,
    // and viewport breakpoints made two narrow cards with their titles three
    // words to a line.
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {roadPaths.map((path) => (
          <RoadPathCard key={path.id} roadPath={path} today={today} timeZone={timeZone} />
        ))}
      </div>
    </div>
  );
}
