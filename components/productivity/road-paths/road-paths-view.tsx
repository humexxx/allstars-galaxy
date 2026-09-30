import { RoadPathCard } from "./road-path-card";
import type { RoadPath } from "@/types";

type RoadPathsViewProps = {
  roadPaths: RoadPath[];
};

/** The grid of road paths. Each card links to its own `?path=` detail. */
export function RoadPathsView({ roadPaths }: RoadPathsViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {roadPaths.map((path) => (
        <RoadPathCard key={path.id} roadPath={path} />
      ))}
    </div>
  );
}
