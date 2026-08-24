import { RoadPathsView } from "@/components/productivity/road-paths/road-paths-view";
import type { Metadata } from "next";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserRoadPaths } from "@/lib/services/road-path-service";
import { CreateRoadPathDialog } from "@/components/productivity/road-paths/create-road-path-dialog";
import { PageHeader } from "@/components/portal/page-header";

export const metadata: Metadata = {
  title: "Road Paths",
  description: "Track your long-term goals and progress",
};

export default async function RoadPathsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const ctx = await requireEffectiveContext();
  const [roadPaths, { path }] = await Promise.all([
    getUserRoadPaths(ctx.effectiveUserId),
    searchParams,
  ]);
  // `?path=` means the view has swapped the grid for one path's detail, and a
  // Create Road Path button sitting on top of that belongs to a screen that is
  // no longer there.
  const showingDetail = Boolean(path);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Road Paths"
        description="Track your long-term goals and progress."
        actions={
          roadPaths.length > 0 && !showingDetail ? <CreateRoadPathDialog /> : undefined
        }
      />
      <RoadPathsView initialRoadPaths={roadPaths} />
    </section>
  );
}
