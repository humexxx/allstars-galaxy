"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { Plus, RefreshCw } from "lucide-react";
import { RoadPathCard } from "./road-path-card";
import { CreateRoadPathDialog } from "./create-road-path-dialog";
import { RoadPathDetail } from "./road-path-detail";
import { getUserRoadPathsAction } from "@/app/actions/road-path";
import type { RoadPath } from "@/types";
import { toast } from "sonner";

type RoadPathsViewProps = {
  initialRoadPaths: RoadPath[];
};

export function RoadPathsView({ initialRoadPaths }: RoadPathsViewProps) {
  const [roadPaths, setRoadPaths] = useState<RoadPath[]>(initialRoadPaths);
  const [selectedPath, setSelectedPath] = useState<RoadPath | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getUserRoadPathsAction();
      if (result.success) {
        setRoadPaths(result.data);
      }
    } catch {
      toast.error("Failed to load road paths");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedPath) {
    return (
      <RoadPathDetail
        roadPath={selectedPath}
        onBack={() => setSelectedPath(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Text variant="muted">
          Track your long-term goals and create automated tasks
        </Text>
        <CreateRoadPathDialog onSuccess={loadData}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Road Path
          </Button>
        </CreateRoadPathDialog>
      </div>

      {roadPaths.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Text variant="muted">No road paths yet. Create your first one!</Text>
          <CreateRoadPathDialog onSuccess={loadData}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Road Path
            </Button>
          </CreateRoadPathDialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roadPaths.map((path) => (
            <RoadPathCard
              key={path.id}
              roadPath={path}
              onClick={() => setSelectedPath(path)}
              onRefresh={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
