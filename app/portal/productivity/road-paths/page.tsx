import { RoadPathsView } from "@/components/productivity/road-paths/road-paths-view";
import type { Metadata } from "next";
import { requireAuthCached } from "@/lib/services/auth-server";
import { getUserRoadPaths } from "@/lib/services/road-path-service";

export const metadata: Metadata = {
  title: "Road Paths | Capital Galaxy",
  description: "Track your long-term goals and progress",
};

export default async function RoadPathsPage() {
  const user = await requireAuthCached();
  const roadPaths = await getUserRoadPaths(user.id);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Road Paths</h1>
        <p className="text-muted-foreground">Track your long-term goals and progress</p>
      </header>
      <RoadPathsView initialRoadPaths={roadPaths} />
    </section>
  );
}
