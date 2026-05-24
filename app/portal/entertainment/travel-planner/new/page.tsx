import type { Metadata } from "next";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/portal/page-header";
import { TripForm } from "@/components/travel/trip-form";
import { FormSkeleton } from "@/components/skeletons/form-skeleton";
import { requireEffectiveContext } from "@/lib/services/impersonation";

export const metadata: Metadata = {
  title: "New trip | Allstars Galaxy",
};

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  await requireEffectiveContext();
  return (
    <section className="space-y-6">
      <PageHeader
        title="New trip"
        description="Pick the dates and a cover photo. You can plan the itinerary on the next screen."
      />
      <Card>
        <CardHeader>
          <CardTitle>Trip basics</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormSkeleton rows={4} />}>
            <TripForm />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
