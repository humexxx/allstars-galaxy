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
  if (!trip) return { title: "Trip | Allstars Galaxy" };
  return {
    title: `${trip.title} | Travel Planner`,
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

  return <TripDetail trip={trip} baseUrl={getBaseUrl()} />;
}
