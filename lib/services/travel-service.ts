import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { trips, tripItems, tripPhotos, tripShares } from "@/db/schema";
import type {
  DashboardTravelFeaturedTrip,
  DashboardTravelSummary,
  DashboardTravelTripState,
  PublicTripView,
  Trip,
  TripItem,
  TripPhoto,
  TripShare,
  TripWithRelations,
} from "@/types/travel";
import type {
  CreateTripInput,
  CreateTripShareInput,
  TripItemInput,
  TripPhotoInput,
  UpdateTripInput,
  UpdateTripItemInput,
} from "@/schemas/travel";

// ---------- helpers ----------

async function ensureTripOwnership(tripId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: trips.userId })
    .from(trips)
    .where(eq(trips.id, tripId));
  if (!row || row.userId !== userId) {
    throw new Error("Trip not found");
  }
}

// URL-safe random token. 24 bytes → 32 chars base64url, ~192 bits of entropy.
// More than enough that brute-force enumeration is impractical without rate
// limits — and we still index the column uniquely as a defense in depth.
function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tripState(trip: Trip, today: string): DashboardTravelTripState {
  const lastDay = trip.endDate ?? trip.startDate;
  if (lastDay < today) return "past";
  if (trip.startDate > today) return "upcoming";
  return "in_progress";
}

// ---------- trip CRUD ----------

export async function listUserTrips(userId: string): Promise<Trip[]> {
  return db
    .select()
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(asc(trips.startDate));
}

/**
 * Wrapped in React's `cache()` so calls from `generateMetadata` and the page
 * body within the same request hit the DB once. Args are part of the cache
 * key, so the per-user filter remains safe.
 */
export const getTripWithRelations = cache(async function getTripWithRelations(
  tripId: string,
  userId: string
): Promise<TripWithRelations | null> {
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
  if (!trip) return null;

  const [items, photos, shares] = await Promise.all([
    db
      .select()
      .from(tripItems)
      .where(eq(tripItems.tripId, tripId))
      .orderBy(asc(tripItems.scheduledOn), asc(tripItems.sortOrder), asc(tripItems.createdAt)),
    db
      .select()
      .from(tripPhotos)
      .where(eq(tripPhotos.tripId, tripId))
      .orderBy(asc(tripPhotos.sortOrder), asc(tripPhotos.createdAt)),
    db
      .select()
      .from(tripShares)
      .where(eq(tripShares.tripId, tripId))
      .orderBy(asc(tripShares.createdAt)),
  ]);

  return { ...trip, items, photos, shares };
});

export async function createTrip(
  userId: string,
  data: CreateTripInput
): Promise<Trip> {
  const [trip] = await db
    .insert(trips)
    .values({
      userId,
      title: data.title,
      destination: data.destination ?? null,
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      coverPhotoUrl: data.coverPhotoUrl ?? null,
      currency: data.currency,
      color: data.color,
    })
    .returning();
  return trip;
}

export async function updateTrip(
  userId: string,
  data: UpdateTripInput
): Promise<Trip> {
  await ensureTripOwnership(data.id, userId);
  const [trip] = await db
    .update(trips)
    .set({
      title: data.title,
      destination: data.destination ?? null,
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      coverPhotoUrl: data.coverPhotoUrl ?? null,
      currency: data.currency,
      color: data.color,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, data.id))
    .returning();
  return trip;
}

export async function deleteTrip(userId: string, tripId: string): Promise<void> {
  await ensureTripOwnership(tripId, userId);
  await db.delete(trips).where(eq(trips.id, tripId));
}

// ---------- items ----------

export async function addTripItem(
  userId: string,
  tripId: string,
  data: TripItemInput
): Promise<TripItem> {
  await ensureTripOwnership(tripId, userId);
  const [row] = await db
    .insert(tripItems)
    .values({
      tripId,
      title: data.title,
      category: data.category,
      link: data.link ?? null,
      price: data.price ?? null,
      scheduledOn: data.scheduledOn ?? null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateTripItem(
  userId: string,
  tripId: string,
  data: UpdateTripItemInput
): Promise<TripItem> {
  await ensureTripOwnership(tripId, userId);
  const [row] = await db
    .update(tripItems)
    .set({
      title: data.title,
      category: data.category,
      link: data.link ?? null,
      price: data.price ?? null,
      scheduledOn: data.scheduledOn ?? null,
      notes: data.notes ?? null,
      sortOrder: data.sortOrder,
      updatedAt: new Date(),
    })
    .where(and(eq(tripItems.id, data.id), eq(tripItems.tripId, tripId)))
    .returning();
  return row;
}

export async function deleteTripItem(
  userId: string,
  tripId: string,
  itemId: string
): Promise<void> {
  await ensureTripOwnership(tripId, userId);
  await db
    .delete(tripItems)
    .where(and(eq(tripItems.id, itemId), eq(tripItems.tripId, tripId)));
}

// ---------- photos ----------

export async function addTripPhoto(
  userId: string,
  tripId: string,
  data: TripPhotoInput
): Promise<TripPhoto> {
  await ensureTripOwnership(tripId, userId);
  const [row] = await db
    .insert(tripPhotos)
    .values({
      tripId,
      url: data.url,
      storagePath: data.storagePath ?? null,
      source: data.source,
      caption: data.caption ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function deleteTripPhoto(
  userId: string,
  tripId: string,
  photoId: string
): Promise<TripPhoto | null> {
  await ensureTripOwnership(tripId, userId);
  const [removed] = await db
    .delete(tripPhotos)
    .where(and(eq(tripPhotos.id, photoId), eq(tripPhotos.tripId, tripId)))
    .returning();
  return removed ?? null;
}

// ---------- shares ----------

export async function createTripShare(
  userId: string,
  tripId: string,
  data: CreateTripShareInput
): Promise<TripShare> {
  await ensureTripOwnership(tripId, userId);
  const [row] = await db
    .insert(tripShares)
    .values({
      tripId,
      token: generateShareToken(),
      inviteeEmail: data.inviteeEmail ?? null,
      expiresAt: data.expiresAt ?? null,
    })
    .returning();
  return row;
}

export async function revokeTripShare(
  userId: string,
  tripId: string,
  shareId: string
): Promise<void> {
  await ensureTripOwnership(tripId, userId);
  await db
    .update(tripShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(tripShares.id, shareId), eq(tripShares.tripId, tripId)));
}

export async function deleteTripShare(
  userId: string,
  tripId: string,
  shareId: string
): Promise<void> {
  await ensureTripOwnership(tripId, userId);
  await db
    .delete(tripShares)
    .where(and(eq(tripShares.id, shareId), eq(tripShares.tripId, tripId)));
}

/**
 * Resolves a public share token to the trip view rendered on `/trips/{token}`.
 *
 * Returns null when:
 *   - the token doesn't exist
 *   - the share has been revoked
 *   - the share has expired
 *
 * No auth required — the token IS the credential. Callers should never expose
 * trip ownership data (userId) or other shares of the same trip back to the
 * public renderer.
 */
export async function getPublicTripByToken(
  token: string
): Promise<PublicTripView | null> {
  const [share] = await db
    .select()
    .from(tripShares)
    .where(and(eq(tripShares.token, token), isNull(tripShares.revokedAt)));
  if (!share) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  const [trip] = await db.select().from(trips).where(eq(trips.id, share.tripId));
  if (!trip) return null;

  const [items, photos] = await Promise.all([
    db
      .select()
      .from(tripItems)
      .where(eq(tripItems.tripId, trip.id))
      .orderBy(asc(tripItems.scheduledOn), asc(tripItems.sortOrder), asc(tripItems.createdAt)),
    db
      .select()
      .from(tripPhotos)
      .where(eq(tripPhotos.tripId, trip.id))
      .orderBy(asc(tripPhotos.sortOrder), asc(tripPhotos.createdAt)),
  ]);

  return { trip, items, photos, share };
}

// ---------- Dashboard summary ----------

/**
 * One-call summary for the /portal dashboard card. Picks a featured trip
 * (in-progress wins, then the next upcoming, then the most recent past) and
 * folds its items into a count + estimate so the card avoids a second query.
 */
export async function getDashboardTravelSummary(
  userId: string
): Promise<DashboardTravelSummary> {
  const all = await db
    .select()
    .from(trips)
    .where(eq(trips.userId, userId))
    .orderBy(asc(trips.startDate));

  if (all.length === 0) {
    return { totalTrips: 0, upcomingCount: 0, inProgressCount: 0, featured: null };
  }

  const today = todayIso();
  const inProgress = all.filter((t) => tripState(t, today) === "in_progress");
  const upcoming = all.filter((t) => tripState(t, today) === "upcoming");
  const past = all.filter((t) => tripState(t, today) === "past");

  const pick =
    inProgress[0] ??
    upcoming[0] ??
    past[past.length - 1] ??
    null;

  let featured: DashboardTravelFeaturedTrip | null = null;
  if (pick) {
    const items = await db
      .select({ price: tripItems.price })
      .from(tripItems)
      .where(eq(tripItems.tripId, pick.id));
    const totalEstimate = items.reduce((sum, row) => {
      if (!row.price) return sum;
      const n = parseFloat(row.price);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
    featured = {
      ...pick,
      state: tripState(pick, today),
      itemCount: items.length,
      totalEstimate,
    };
  }

  return {
    totalTrips: all.length,
    upcomingCount: upcoming.length,
    inProgressCount: inProgress.length,
    featured,
  };
}
