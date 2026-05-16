import { RoadPathsView } from "@/components/productivity/road-paths/road-paths-view";
import type { Metadata } from "next";
import { requireAuthCached } from "@/lib/services/auth-server";
import { getUserRoadPaths } from "@/lib/services/road-path-service";
import { PageHeader } from "@/components/portal/page-header";

export const metadata: Metadata = {
  title: "Road Paths | Capital Galaxy",
  description: "Track your long-term goals and progress",
};

export default async function RoadPathsPage() {
  const user = await requireAuthCached();
  const roadPaths = await getUserRoadPaths(user.id);

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
