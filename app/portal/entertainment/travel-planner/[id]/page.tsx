import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripDetail } from "@/components/travel/trip-detail";
import { getBaseUrl } from "@/lib/env";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getTripWithRelations } from "@/lib/services/travel-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const trip = await getTripWithRelations(id, ctx.effectiveUserId);
  if (!trip) return { title: "Trip" };
  return {
    title: trip.title,
    description: trip.description ?? trip.destination ?? undefined,
  };
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireEffectiveContext();
  const trip = await getTripWithRelations(id, ctx.effectiveUserId);
  if (!trip) notFound();

  // Identity comes from the effective context, so an impersonating admin sees
  // the impersonated user marked rather than themselves.
  return (
    <TripDetail
      trip={trip}
      baseUrl={getBaseUrl()}
      currentUserEmail={ctx.impersonatedUser?.email ?? ctx.realUser.email ?? null}
      currentUserName={
        ctx.impersonatedUser?.fullName ??
        (ctx.realUser.user_metadata?.full_name as string | undefined) ??
        null
      }
    />
  );
}
