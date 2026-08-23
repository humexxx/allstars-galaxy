"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { Plus } from "lucide-react";
import { RoadPathCard } from "./road-path-card";
import { CreateRoadPathDialog } from "./create-road-path-dialog";
import { RoadPathDetail } from "./road-path-detail";
import type { RoadPath } from "@/types";

type RoadPathsViewProps = {
  initialRoadPaths: RoadPath[];
};

export function RoadPathsView({ initialRoadPaths }: RoadPathsViewProps) {
  const router = useRouter();
  const params = useSearchParams();

  /**
   * The open path lives in the URL, not in component state.
   *
   * As state it had no history entry: Back walked out of the module instead of
   * returning to the list, a refresh dropped you back to the grid, and the
   * detail could not be linked to at all. It also went stale — the detail held
   * whatever snapshot the list had when it was clicked, so a logged progress
   * value updated the percentage and not the figure underneath it.
   */
  const openId = params.get("path");
  const selectedPath = openId
    ? (initialRoadPaths.find((p) => p.id === openId) ?? null)
    : null;

  /**
   * Server data is the source of truth; the actions already revalidate it.
   *
   * Memoised because the detail view puts it in a dependency list — a fresh
   * closure on every render turned that into an endless reload.
   */
  const refresh = useCallback(() => router.refresh(), [router]);

  const open = (id: string) => router.push(`?path=${id}`, { scroll: false });
  const close = () => router.push("?", { scroll: false });

  if (selectedPath) {
    return <RoadPathDetail roadPath={selectedPath} onBack={close} onRefresh={refresh} />;
  }

  // A path id that no longer resolves — deleted, or somebody else's link.
  if (openId) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Text variant="muted">That road path is not here any more.</Text>
        <Button variant="outline" onClick={close}>
          Back to all road paths
        </Button>
      </div>
    );
  }

  if (initialRoadPaths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16">
        <Text variant="muted">No road paths yet. Create your first one.</Text>
        <CreateRoadPathDialog onSuccess={refresh}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Road Path
          </Button>
        </CreateRoadPathDialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initialRoadPaths.map((path) => (
          <RoadPathCard
            key={path.id}
            roadPath={path}
            onClick={() => open(path.id)}
            onRefresh={refresh}
          />
        ))}
      </div>
  );
}
