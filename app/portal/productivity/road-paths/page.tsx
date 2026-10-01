import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Route } from "lucide-react";

import { PageHeader } from "@/components/portal/page-header";
import { CreateRoadPathDialog } from "@/components/productivity/road-paths/create-road-path-dialog";
import { RoadPathDetail } from "@/components/productivity/road-paths/road-path-detail";
import { RoadPathDetailSkeleton } from "@/components/productivity/road-paths/road-path-detail-skeleton";
import { RoadPathsView } from "@/components/productivity/road-paths/road-paths-view";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getRoadPathDetail, getUserRoadPaths } from "@/lib/services/road-path-service";
import { idSchema } from "@/schemas/common";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { dayKey } from "@/components/productivity/zoned-date";

export const metadata: Metadata = {
  title: "Road Paths",
  description: "Track your long-term goals and progress",
};

const LIST_HREF = "/portal/productivity/road-paths";

/**
 * The open path lives in the URL (`?path=`), not in component state: Back
 * returns to the list, a refresh keeps the detail, and it can be linked to.
 * It is read here on the server, so the detail arrives with the page and the
 * actions' `revalidatePath` keeps it current — no client fetch, no refresh.
 */
export default async function RoadPathsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;

  if (path) {
    // Keyed on the id so opening another path shows the skeleton again
    // instead of the previous path's figures.
    return (
      <Suspense key={path} fallback={<RoadPathDetailSkeleton />}>
        <RoadPathDetailScreen id={path} />
      </Suspense>
    );
  }

  const ctx = await requireEffectiveContext();
  const [roadPaths, timeZone] = await Promise.all([
    getUserRoadPaths(ctx.effectiveUserId),
    getRequestTimeZone(),
  ]);

  return (
    <>
      <PageHeader
        title="Road paths"
        description="Track your long-term goals and progress."
        actions={roadPaths.length > 0 ? <CreateRoadPathDialog /> : undefined}
      />
      {roadPaths.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Route}
          title="No road paths yet"
          description="Set up a long-term goal and log your progress towards it."
          action={<CreateRoadPathDialog />}
        />
      ) : (
        <RoadPathsView roadPaths={roadPaths} today={dayKey(new Date(), timeZone)} />
      )}
    </>
  );
}

async function RoadPathDetailScreen({ id }: { id: string }) {
  const ctx = await requireEffectiveContext();
  const [detail, timeZone] = await Promise.all([
    idSchema.safeParse(id).success ? getRoadPathDetail(id, ctx.effectiveUserId) : null,
    getRequestTimeZone(),
  ]);

  // Deleted, or somebody else's link.
  if (!detail) {
    return (
      <EmptyState
        variant="card"
        icon={Route}
        title="Road path not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link href={LIST_HREF}>Back to all road paths</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: LIST_HREF, label: "Road paths" }}
        title={detail.roadPath.title}
        description={detail.roadPath.description ?? undefined}
      />
      <RoadPathDetail detail={detail} timeZone={timeZone} />
    </>
  );
}
