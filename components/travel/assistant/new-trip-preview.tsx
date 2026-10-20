"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { TripDetail } from "../trip-detail";
import { reviveTrip, usePendingProposal } from "./pending-preview";

/**
 * The page of a trip the open proposal would create: the trip page itself,
 * drawn from the preview, every part of it marked as new. Reached only from
 * the assistant; a reload has nothing to show, since the proposal lives in
 * the chat.
 */
export function NewTripPreview() {
  const proposal = usePendingProposal();
  const preview = proposal?.previews.find((p) => p.isNew && p.trip);
  if (!preview?.trip) {
    return (
      <EmptyState
        variant="card"
        icon={Sparkles}
        title="Nothing to preview"
        description="A new trip the assistant proposes shows up here until you apply or discard it."
        action={
          <Button asChild variant="outline">
            <Link href="/portal/entertainment/travel-planner">All trips</Link>
          </Button>
        }
      />
    );
  }
  return <TripDetail trip={reviveTrip(preview.trip)} baseUrl="" />;
}
