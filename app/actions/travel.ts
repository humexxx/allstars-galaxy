"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  addTripItem,
  addTripPhoto,
  createTrip,
  createTripShare,
  deleteTrip,
  deleteTripItem,
  deleteTripPhoto,
  deleteTripShare,
  revokeTripShare,
  updateTrip,
  updateTripItem,
  moveTripItem,
  setTripItemStops,
  setTripMembers,
  addTripContribution,
  updateTripContribution,
  deleteTripContribution,
} from "@/lib/services/travel-service";
import { idSchema } from "@/schemas/common";
import {
  createTripSchema,
  createTripShareSchema,
  tripItemSchema,
  tripPhotoSchema,
  updateTripItemSchema,
  moveTripItemSchema,
  updateTripSchema,
  type CreateTripInput,
  type CreateTripShareInput,
  type TripItemInput,
  type TripPhotoInput,
  type UpdateTripInput,
  type UpdateTripItemInput,
  type MoveTripItemData,
  setItemStopsSchema,
  type SetItemStopsData,
  setTripMembersSchema,
  type SetTripMembersData,
  tripChildIdsSchema,
  tripContributionSchema,
  updateTripContributionSchema,
  type TripContributionData,
  type UpdateTripContributionData,
} from "@/schemas/travel";
import type { Trip, TripContribution, TripItem, TripPhoto, TripShare } from "@/types/travel";

const TRIP_LIST_PATH = "/portal/entertainment/travel-planner";
/** The dashboard's travel card: trip dates, item count, estimate, party size. */
const DASHBOARD_PATH = "/portal";

function pathForTrip(tripId: string): string {
  return `${TRIP_LIST_PATH}/${tripId}`;
}

/**
 * The trip page, plus the dashboard when the change is one its travel card
 * shows (dates, items, prices, travellers). Photos, shares and payments are
 * not on the card, so they leave the dashboard's cache alone.
 */
function revalidateTrip(tripId: string, { dashboard }: { dashboard: boolean }): void {
  revalidatePath(pathForTrip(tripId));
  if (dashboard) revalidatePath(DASHBOARD_PATH);
}

// ---------- trips ----------

export async function createTripAction(input: CreateTripInput): Promise<ActionResult<Trip>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createTripSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const trip = await createTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.create",
      entityTable: "trips",
      entityId: trip.id,
      after: trip,
    });
    revalidatePath(TRIP_LIST_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { success: true, data: trip };
  });
}

export async function updateTripAction(input: UpdateTripInput): Promise<ActionResult<Trip>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateTripSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const trip = await updateTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.update",
      entityTable: "trips",
      entityId: trip.id,
      after: trip,
    });
    revalidatePath(TRIP_LIST_PATH);
    revalidateTrip(parsed.data.id, { dashboard: true });
    return { success: true, data: trip };
  });
}

export async function deleteTripAction(tripId: string): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(tripId);
    if (!parsed.success) return { success: false, error: "Invalid id" };
    await deleteTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.delete",
      entityTable: "trips",
      entityId: parsed.data,
    });
    revalidatePath(TRIP_LIST_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  });
}

// ---------- items ----------

export async function addTripItemAction(
  tripId: string,
  input: TripItemInput
): Promise<ActionResult<TripItem>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = tripItemSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await addTripItem(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripItem.create",
      entityTable: "trip_items",
      entityId: row.id,
    });
    revalidateTrip(idParsed.data, { dashboard: true });
    return { success: true, data: row };
  });
}

export async function updateTripItemAction(
  tripId: string,
  input: UpdateTripItemInput
): Promise<ActionResult<TripItem>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = updateTripItemSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await updateTripItem(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripItem.update",
      entityTable: "trip_items",
      entityId: row.id,
    });
    revalidateTrip(idParsed.data, { dashboard: true });
    return { success: true, data: row };
  });
}

export async function moveTripItemAction(
  tripId: string,
  input: MoveTripItemData
): Promise<ActionResult<TripItem>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = moveTripItemSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await moveTripItem(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripItem.move",
      entityTable: "trip_items",
      entityId: row.id,
      metadata: { scheduledOn: parsed.data.scheduledOn, endsOn: parsed.data.endsOn ?? null },
    });
    revalidateTrip(idParsed.data, { dashboard: true });
    return { success: true, data: row };
  });
}

export async function deleteTripItemAction(
  tripId: string,
  itemId: string
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = idSchema.safeParse(tripId);
    const itemIdParsed = idSchema.safeParse(itemId);
    if (!tripIdParsed.success || !itemIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await deleteTripItem(ctx.effectiveUserId, tripIdParsed.data, itemIdParsed.data);
    await logImpersonatedMutation({
      action: "tripItem.delete",
      entityTable: "trip_items",
      entityId: itemIdParsed.data,
    });
    revalidateTrip(tripIdParsed.data, { dashboard: true });
    return { success: true };
  });
}

// ---------- photos ----------

export async function addTripPhotoAction(
  tripId: string,
  input: TripPhotoInput
): Promise<ActionResult<TripPhoto>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = tripPhotoSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await addTripPhoto(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripPhoto.create",
      entityTable: "trip_photos",
      entityId: row.id,
    });
    revalidateTrip(idParsed.data, { dashboard: false });
    return { success: true, data: row };
  });
}

export async function deleteTripPhotoAction(
  tripId: string,
  photoId: string
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = idSchema.safeParse(tripId);
    const photoIdParsed = idSchema.safeParse(photoId);
    if (!tripIdParsed.success || !photoIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    const removed = await deleteTripPhoto(
      ctx.effectiveUserId,
      tripIdParsed.data,
      photoIdParsed.data
    );

    // Best-effort cleanup of the underlying storage object for uploads. We
    // ignore storage errors so a missing/already-deleted blob doesn't fail the
    // whole action — the DB row is gone either way.
    if (removed?.source === "upload" && removed.storagePath) {
      try {
        const { createClient } = await import("@/lib/supabase-server");
        const supabase = await createClient();
        await supabase.storage.from("trip-photos").remove([removed.storagePath]);
      } catch (err) {
        console.warn("[travel action] storage cleanup failed:", err);
      }
    }

    await logImpersonatedMutation({
      action: "tripPhoto.delete",
      entityTable: "trip_photos",
      entityId: photoIdParsed.data,
    });
    revalidateTrip(tripIdParsed.data, { dashboard: false });
    return { success: true };
  });
}

// ---------- shares ----------

export async function createTripShareAction(
  tripId: string,
  input: CreateTripShareInput
): Promise<ActionResult<TripShare>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = createTripShareSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await createTripShare(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripShare.create",
      entityTable: "trip_shares",
      entityId: row.id,
      metadata: {
        inviteeEmail: parsed.data.inviteeEmail ?? null,
        // Which traveller a link exposes is the interesting half of an audit
        // entry about creating one.
        memberId: parsed.data.memberId ?? null,
        showPrices: row.showPrices,
      },
    });
    revalidateTrip(idParsed.data, { dashboard: false });
    return { success: true, data: row };
  });
}

export async function revokeTripShareAction(
  tripId: string,
  shareId: string
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = idSchema.safeParse(tripId);
    const shareIdParsed = idSchema.safeParse(shareId);
    if (!tripIdParsed.success || !shareIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await revokeTripShare(ctx.effectiveUserId, tripIdParsed.data, shareIdParsed.data);
    await logImpersonatedMutation({
      action: "tripShare.revoke",
      entityTable: "trip_shares",
      entityId: shareIdParsed.data,
    });
    revalidateTrip(tripIdParsed.data, { dashboard: false });
    return { success: true };
  });
}

export async function deleteTripShareAction(
  tripId: string,
  shareId: string
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = idSchema.safeParse(tripId);
    const shareIdParsed = idSchema.safeParse(shareId);
    if (!tripIdParsed.success || !shareIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await deleteTripShare(ctx.effectiveUserId, tripIdParsed.data, shareIdParsed.data);
    await logImpersonatedMutation({
      action: "tripShare.delete",
      entityTable: "trip_shares",
      entityId: shareIdParsed.data,
    });
    revalidateTrip(tripIdParsed.data, { dashboard: false });
    return { success: true };
  });
}

/**
 * Replace a cruise's day-by-day itinerary.
 *
 * The whole list at once: an itinerary is pasted and corrected as a block, and
 * a per-row action would leave it half-saved the moment one row failed.
 */
export async function setTripItemStopsAction(
  tripId: string,
  input: SetItemStopsData
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = setItemStopsSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return {
        success: false,
        error: parsed.success ? "Invalid trip" : parsed.error.issues[0].message,
      };
    }

    await setTripItemStops(
      ctx.effectiveUserId,
      idParsed.data,
      parsed.data.itemId,
      parsed.data.stops
    );
    await logImpersonatedMutation({
      action: "tripItemStops.set",
      entityTable: "trip_item_stops",
      entityId: parsed.data.itemId,
      after: { count: parsed.data.stops.length },
    });
    revalidateTrip(idParsed.data, { dashboard: false });
    return { success: true };
  });
}

/** Replace a trip's traveller list. */
export async function setTripMembersAction(
  tripId: string,
  input: SetTripMembersData
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = setTripMembersSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return {
        success: false,
        error: parsed.success ? "Invalid trip" : parsed.error.issues[0].message,
      };
    }

    await setTripMembers(ctx.effectiveUserId, idParsed.data, parsed.data.members);
    await logImpersonatedMutation({
      action: "tripMembers.set",
      entityTable: "trip_members",
      entityId: idParsed.data,
      after: { count: parsed.data.members.length },
    });
    revalidateTrip(idParsed.data, { dashboard: true });
    return { success: true };
  });
}

// ---------- contributions ----------

export async function addTripContributionAction(
  tripId: string,
  input: TripContributionData
): Promise<ActionResult<TripContribution>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = tripContributionSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await addTripContribution(
      ctx.effectiveUserId,
      idParsed.data,
      parsed.data
    );
    await logImpersonatedMutation({
      action: "tripContribution.create",
      entityTable: "trip_contributions",
      entityId: row.id,
      metadata: { memberId: parsed.data.memberId, amount: parsed.data.amount },
    });
    revalidateTrip(idParsed.data, { dashboard: false });
    return { success: true, data: row };
  });
}

export async function updateTripContributionAction(
  tripId: string,
  input: UpdateTripContributionData
): Promise<ActionResult<TripContribution>> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(tripId);
    const parsed = updateTripContributionSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await updateTripContribution(
      ctx.effectiveUserId,
      idParsed.data,
      parsed.data
    );
    await logImpersonatedMutation({
      action: "tripContribution.update",
      entityTable: "trip_contributions",
      entityId: row.id,
      metadata: { amount: parsed.data.amount },
    });
    revalidateTrip(idParsed.data, { dashboard: false });
    return { success: true, data: row };
  });
}

export async function deleteTripContributionAction(
  tripId: string,
  contributionId: string
): Promise<ActionResult> {
  return safe("travel", async () => {
    const ctx = await requireEffectiveContext();
    const ids = tripChildIdsSchema.safeParse({ tripId, childId: contributionId });
    if (!ids.success) {
      return { success: false, error: "Invalid input" };
    }
    await deleteTripContribution(ctx.effectiveUserId, ids.data.tripId, ids.data.childId);
    await logImpersonatedMutation({
      action: "tripContribution.delete",
      entityTable: "trip_contributions",
      entityId: ids.data.childId,
    });
    revalidateTrip(ids.data.tripId, { dashboard: false });
    return { success: true };
  });
}
