import { RoadPathsView } from "@/components/productivity/road-paths/road-paths-view";
import type { Metadata } from "next";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserRoadPaths } from "@/lib/services/road-path-service";
import { PageHeader } from "@/components/portal/page-header";

export const metadata: Metadata = {
  title: "Road Paths | Allstars Galaxy",
  description: "Track your long-term goals and progress",
};

export default async function RoadPathsPage() {
  const ctx = await requireEffectiveContext();
  const roadPaths = await getUserRoadPaths(ctx.effectiveUserId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Road Paths"
        description="Track your long-term goals and progress."
      />
      <RoadPathsView initialRoadPaths={roadPaths} />
    </section>
  );
}
