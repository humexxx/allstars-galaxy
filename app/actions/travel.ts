"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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
} from "@/lib/services/travel-service";
import {
  createTripSchema,
  createTripShareSchema,
  tripItemSchema,
  tripPhotoSchema,
  updateTripItemSchema,
  updateTripSchema,
  type CreateTripInput,
  type CreateTripShareInput,
  type TripItemInput,
  type TripPhotoInput,
  type UpdateTripInput,
  type UpdateTripItemInput,
} from "@/schemas/travel";

const TRIP_LIST_PATH = "/portal/entertainment/travel-planner";

function pathForTrip(tripId: string): string {
  return `${TRIP_LIST_PATH}/${tripId}`;
}

async function safe<T>(
  fn: () => Promise<{ success: true; data?: T } | { success: false; error: string }>
): Promise<{ success: true; data?: T } | { success: false; error: string }> {
  try {
    return await fn();
  } catch (err) {
    console.error("[travel action] failed:", err);
    return { success: false, error: "Action failed" };
  }
}

// ---------- trips ----------

export async function createTripAction(input: CreateTripInput) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createTripSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const trip = await createTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.create",
      entityTable: "trips",
      entityId: trip.id,
      after: trip,
    });
    revalidatePath(TRIP_LIST_PATH);
    return { success: true as const, data: trip };
  });
}

export async function updateTripAction(input: UpdateTripInput) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateTripSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const trip = await updateTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.update",
      entityTable: "trips",
      entityId: trip.id,
      after: trip,
    });
    revalidatePath(TRIP_LIST_PATH);
    revalidatePath(pathForTrip(parsed.data.id));
    return { success: true as const, data: trip };
  });
}

export async function deleteTripAction(tripId: string) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const parsed = z.string().uuid().safeParse(tripId);
    if (!parsed.success) return { success: false as const, error: "Invalid id" };
    await deleteTrip(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "trip.delete",
      entityTable: "trips",
      entityId: parsed.data,
    });
    revalidatePath(TRIP_LIST_PATH);
    return { success: true as const };
  });
}

// ---------- items ----------

export async function addTripItemAction(tripId: string, input: TripItemInput) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = z.string().uuid().safeParse(tripId);
    const parsed = tripItemSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const row = await addTripItem(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripItem.create",
      entityTable: "trip_items",
      entityId: row.id,
    });
    revalidatePath(pathForTrip(idParsed.data));
    return { success: true as const, data: row };
  });
}

export async function updateTripItemAction(
  tripId: string,
  input: UpdateTripItemInput
) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = z.string().uuid().safeParse(tripId);
    const parsed = updateTripItemSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const row = await updateTripItem(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripItem.update",
      entityTable: "trip_items",
      entityId: row.id,
    });
    revalidatePath(pathForTrip(idParsed.data));
    return { success: true as const, data: row };
  });
}

export async function deleteTripItemAction(tripId: string, itemId: string) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = z.string().uuid().safeParse(tripId);
    const itemIdParsed = z.string().uuid().safeParse(itemId);
    if (!tripIdParsed.success || !itemIdParsed.success) {
      return { success: false as const, error: "Invalid id" };
    }
    await deleteTripItem(ctx.effectiveUserId, tripIdParsed.data, itemIdParsed.data);
    await logImpersonatedMutation({
      action: "tripItem.delete",
      entityTable: "trip_items",
      entityId: itemIdParsed.data,
    });
    revalidatePath(pathForTrip(tripIdParsed.data));
    return { success: true as const };
  });
}

// ---------- photos ----------

export async function addTripPhotoAction(tripId: string, input: TripPhotoInput) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = z.string().uuid().safeParse(tripId);
    const parsed = tripPhotoSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const row = await addTripPhoto(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripPhoto.create",
      entityTable: "trip_photos",
      entityId: row.id,
    });
    revalidatePath(pathForTrip(idParsed.data));
    return { success: true as const, data: row };
  });
}

export async function deleteTripPhotoAction(tripId: string, photoId: string) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = z.string().uuid().safeParse(tripId);
    const photoIdParsed = z.string().uuid().safeParse(photoId);
    if (!tripIdParsed.success || !photoIdParsed.success) {
      return { success: false as const, error: "Invalid id" };
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
    revalidatePath(pathForTrip(tripIdParsed.data));
    return { success: true as const };
  });
}

// ---------- shares ----------

export async function createTripShareAction(
  tripId: string,
  input: CreateTripShareInput
) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = z.string().uuid().safeParse(tripId);
    const parsed = createTripShareSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const row = await createTripShare(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "tripShare.create",
      entityTable: "trip_shares",
      entityId: row.id,
      metadata: { inviteeEmail: parsed.data.inviteeEmail ?? null },
    });
    revalidatePath(pathForTrip(idParsed.data));
    return { success: true as const, data: row };
  });
}

export async function revokeTripShareAction(tripId: string, shareId: string) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = z.string().uuid().safeParse(tripId);
    const shareIdParsed = z.string().uuid().safeParse(shareId);
    if (!tripIdParsed.success || !shareIdParsed.success) {
      return { success: false as const, error: "Invalid id" };
    }
    await revokeTripShare(ctx.effectiveUserId, tripIdParsed.data, shareIdParsed.data);
    await logImpersonatedMutation({
      action: "tripShare.revoke",
      entityTable: "trip_shares",
      entityId: shareIdParsed.data,
    });
    revalidatePath(pathForTrip(tripIdParsed.data));
    return { success: true as const };
  });
}

export async function deleteTripShareAction(tripId: string, shareId: string) {
  return safe(async () => {
    const ctx = await requireEffectiveContext();
    const tripIdParsed = z.string().uuid().safeParse(tripId);
    const shareIdParsed = z.string().uuid().safeParse(shareId);
    if (!tripIdParsed.success || !shareIdParsed.success) {
      return { success: false as const, error: "Invalid id" };
    }
    await deleteTripShare(ctx.effectiveUserId, tripIdParsed.data, shareIdParsed.data);
    await logImpersonatedMutation({
      action: "tripShare.delete",
      entityTable: "trip_shares",
      entityId: shareIdParsed.data,
    });
    revalidatePath(pathForTrip(tripIdParsed.data));
    return { success: true as const };
  });
}
