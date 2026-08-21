import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";

import { and, asc, desc, eq, isNull, notInArray } from "drizzle-orm";

import { db } from "@/db";
import {
  trips,
  tripContributions,
  tripItems,
  tripItemStops,
  tripMembers,
  tripPhotos,
  tripShares,
} from "@/db/schema";
import type {
  DashboardTravelFeaturedTrip,
  DashboardTravelSummary,
  DashboardTravelTripState,
  PublicTripScope,
  PublicTripView,
  Trip,
  TripContribution,
  TripItem,
  TripPhoto,
  TripShare,
  TripWithRelations,
} from "@/types/travel";
import type {
  CreateTripInput,
  CreateTripShareInput,
  TripContributionInput,
  TripItemInput,
  TripPhotoInput,
  UpdateTripInput,
  UpdateTripItemInput,
} from "@/schemas/travel";

import { splitTrip } from "@/lib/travel/split";

import { ensureOwnedRow } from "./ownership";

// ---------- helpers ----------

async function ensureTripOwnership(tripId: string, userId: string): Promise<void> {
  await ensureOwnedRow({
    table: trips,
    idColumn: trips.id,
    id: tripId,
    userId,
    entity: "Trip",
  });
}

/**
 * A member id is only meaningful inside its own trip.
 *
 * The foreign key proves the row exists; it says nothing about *which* trip it
 * belongs to. Scoping a share or a payment to a member borrowed from another
 * trip would otherwise be accepted.
 */
async function ensureMemberBelongsToTrip(
  memberId: string,
  tripId: string
): Promise<void> {
  const [row] = await db
    .select({ id: tripMembers.id })
    .from(tripMembers)
    .where(and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)));
  if (!row) throw new Error("Traveller not found on this trip");
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

  const [items, photos, shares, stops, members, contributions] = await Promise.all([
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
    // Every stop for this trip in one query, attached to its item below. A
    // query per item would be N+1 for something that is at most a couple of
    // dozen rows.
    db
      .select({
        id: tripItemStops.id,
        itemId: tripItemStops.itemId,
        dayNumber: tripItemStops.dayNumber,
        stopOn: tripItemStops.stopOn,
        place: tripItemStops.place,
        note: tripItemStops.note,
      })
      .from(tripItemStops)
      .innerJoin(tripItems, eq(tripItemStops.itemId, tripItems.id))
      .where(eq(tripItems.tripId, tripId))
      .orderBy(asc(tripItemStops.dayNumber)),
    db
      .select({
        id: tripMembers.id,
        name: tripMembers.name,
        email: tripMembers.email,
        sharePercent: tripMembers.sharePercent,
      })
      .from(tripMembers)
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(asc(tripMembers.sortOrder), asc(tripMembers.createdAt)),
    db
      .select()
      .from(tripContributions)
      .where(eq(tripContributions.tripId, tripId))
      // Newest first: a payment log is read from the top, and the question it
      // answers is "did the last one land", not "what happened first".
      .orderBy(desc(tripContributions.paidOn), desc(tripContributions.createdAt)),
  ]);

  const stopsByItem = new Map<string, typeof stops>();
  for (const stop of stops) {
    const list = stopsByItem.get(stop.itemId) ?? [];
    list.push(stop);
    stopsByItem.set(stop.itemId, list);
  }

  return {
    ...trip,
    items: items.map((i) => ({ ...i, stops: stopsByItem.get(i.id) ?? [] })),
    photos,
    shares,
    contributions,
    members: members.map((m) => ({
      ...m,
      sharePercent: m.sharePercent === null ? null : Number(m.sharePercent),
    })),
  };
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
      videoUrl: data.videoUrl ?? null,
      fromCode: data.fromCode ?? null,
      toCode: data.toCode ?? null,
      roundTrip: data.roundTrip ?? false,
      priceMax: data.priceMax ?? null,
      priceUnit: data.priceUnit ?? "total",
      endsOn: data.endsOn ?? null,
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
      videoUrl: data.videoUrl ?? null,
      fromCode: data.fromCode ?? null,
      toCode: data.toCode ?? null,
      roundTrip: data.roundTrip ?? false,
      priceMax: data.priceMax ?? null,
      priceUnit: data.priceUnit ?? "total",
      endsOn: data.endsOn ?? null,
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
  if (data.memberId) await ensureMemberBelongsToTrip(data.memberId, tripId);

  const [row] = await db
    .insert(tripShares)
    .values({
      tripId,
      token: generateShareToken(),
      inviteeEmail: data.inviteeEmail ?? null,
      memberId: data.memberId ?? null,
      // A link scoped to one traveller exists to show that traveller their
      // own bill, so it carries prices unless the caller says otherwise. An
      // unscoped link keeps the cautious default.
      showPrices: data.showPrices ?? Boolean(data.memberId),
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

// ---------- contributions ----------

/**
 * Records money a traveller has actually handed over.
 *
 * The member is re-checked against this trip rather than trusted from the
 * request. The foreign key only proves the id names *a* member somewhere —
 * without this check a caller could credit a payment against a stranger's
 * trip and read the balance back through their own.
 */
export async function addTripContribution(
  userId: string,
  tripId: string,
  data: TripContributionInput
): Promise<TripContribution> {
  await ensureTripOwnership(tripId, userId);
  await ensureMemberBelongsToTrip(data.memberId, tripId);

  const [row] = await db
    .insert(tripContributions)
    .values({
      tripId,
      memberId: data.memberId,
      amount: data.amount,
      note: data.note ?? null,
      paidOn: data.paidOn ?? todayIso(),
    })
    .returning();
  return row;
}

export async function deleteTripContribution(
  userId: string,
  tripId: string,
  contributionId: string
): Promise<void> {
  await ensureTripOwnership(tripId, userId);
  await db
    .delete(tripContributions)
    .where(
      and(
        eq(tripContributions.id, contributionId),
        eq(tripContributions.tripId, tripId)
      )
    );
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
 *
 * `React.cache()` so `generateMetadata` and the page body share one DB hit per
 * request — same reason `getTripWithRelations` is wrapped.
 */
export const getPublicTripByToken = cache(async function getPublicTripByToken(
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

  // Everything the page needs in one round of queries. The scope's members
  // and payments do not depend on the items or the photos, so awaiting them
  // afterwards would have cost a second round trip for no ordering reason —
  // and at ~86ms each that is the whole budget of a small page.
  const [items, photos, scopeRows] = await Promise.all([
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
    share.memberId ? loadScopeRows(trip.id, share.memberId) : null,
  ]);

  return {
    trip,
    items,
    photos,
    share,
    // Built from the items already in hand rather than fetched again.
    scope: scopeRows ? buildScope(scopeRows, items, share.memberId!) : null,
  };
});

/**
 * The rows a scoped link needs, fetched alongside everything else.
 *
 * Split from the arithmetic so the queries can join the page's one round of
 * IO instead of forming a second one behind it.
 */
async function loadScopeRows(tripId: string, memberId: string) {
  const [members, paidRows] = await Promise.all([
    db
      .select({
        id: tripMembers.id,
        name: tripMembers.name,
        sharePercent: tripMembers.sharePercent,
      })
      .from(tripMembers)
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(asc(tripMembers.sortOrder), asc(tripMembers.createdAt)),
    db
      .select({ amount: tripContributions.amount })
      .from(tripContributions)
      .where(
        and(
          eq(tripContributions.tripId, tripId),
          eq(tripContributions.memberId, memberId)
        )
      ),
  ]);
  return { members, paidRows };
}

/**
 * One traveller's own view of the trip, worked out here rather than in the
 * browser.
 *
 * Splitting the cost needs every member — their count sets the party size and
 * their percentages set the shares — but only the named traveller's figures
 * are returned. Sending the full member list to the page and filtering there
 * would put the other travellers' names and balances in the payload of a link
 * created specifically to hide them.
 */
function buildScope(
  rows: Awaited<ReturnType<typeof loadScopeRows>>,
  items: TripItem[],
  memberId: string
): PublicTripScope | null {
  const { members, paidRows } = rows;

  const me = members.find((m) => m.id === memberId);
  // The traveller was removed from the trip after the link went out. The
  // column is ON DELETE SET NULL so this is nearly unreachable, but a link
  // that silently reports somebody else's bill would be far worse than one
  // that falls back to the trip.
  if (!me) return null;

  const shares = splitTrip(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      price: i.price,
      priceMax: i.priceMax,
      priceUnit: i.priceUnit,
      scheduledOn: i.scheduledOn,
      endsOn: i.endsOn,
      payerIds: [],
    })),
    members.map((m) => ({
      id: m.id,
      name: m.name,
      sharePercent: m.sharePercent === null ? null : Number(m.sharePercent),
    }))
  );

  const mine = shares.find((sh) => sh.memberId === memberId);
  if (!mine) return null;

  return {
    memberName: me.name,
    lines: mine.lines.map((l) => ({ itemId: l.itemId, low: l.low, high: l.high })),
    owedLow: mine.owedLow,
    owedHigh: mine.owedHigh,
    paid: paidRows.reduce((sum, r) => sum + parseFloat(r.amount ?? "0"), 0),
  };
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

/**
 * Replace an item's itinerary wholesale.
 *
 * Delete-then-insert inside one transaction rather than diffing: the list is a
 * couple of dozen rows, it is edited as a block, and a diff would have to
 * reason about renumbered days for no benefit the user can see.
 *
 * Ownership is checked through the item's trip, so a stop can never be written
 * onto somebody else's cruise.
 */
export async function setTripItemStops(
  userId: string,
  tripId: string,
  itemId: string,
  stops: {
    dayNumber: number;
    stopOn?: string | null;
    place: string;
    note?: string | null;
  }[]
): Promise<void> {
  const [owned] = await db
    .select({ id: tripItems.id })
    .from(tripItems)
    .innerJoin(trips, eq(tripItems.tripId, trips.id))
    .where(
      and(
        eq(tripItems.id, itemId),
        eq(tripItems.tripId, tripId),
        eq(trips.userId, userId)
      )
    );
  if (!owned) throw new Error("Item not found");

  await db.transaction(async (tx) => {
    await tx.delete(tripItemStops).where(eq(tripItemStops.itemId, itemId));
    if (stops.length === 0) return;
    await tx.insert(tripItemStops).values(
      stops.map((s) => ({
        itemId,
        dayNumber: s.dayNumber,
        stopOn: s.stopOn ?? null,
        place: s.place,
        note: s.note ?? null,
      }))
    );
  });
}

/** Everyone on a trip, in the order they were added. */
export async function listTripMembers(userId: string, tripId: string) {
  return db
    .select({
      id: tripMembers.id,
      name: tripMembers.name,
      email: tripMembers.email,
      sharePercent: tripMembers.sharePercent,
    })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(and(eq(tripMembers.tripId, tripId), eq(trips.userId, userId)))
    .orderBy(asc(tripMembers.sortOrder), asc(tripMembers.createdAt));
}

/**
 * Replace the traveller list wholesale.
 *
 * Same reasoning as the itinerary: it is edited as one list, and a per-row API
 * would leave a trip half-populated whenever one row failed. Removing somebody
 * cascades their per-item payer rows, which is what should happen — a person
 * who is not on the trip cannot be paying for part of it.
 */
export async function setTripMembers(
  userId: string,
  tripId: string,
  members: { id?: string; name: string; email?: string | null; sharePercent?: number | null }[]
): Promise<void> {
  const [owned] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
  if (!owned) throw new Error("Trip not found");

  await db.transaction(async (tx) => {
    const keep = members.map((m) => m.id).filter((id): id is string => !!id);
    await tx
      .delete(tripMembers)
      .where(
        keep.length > 0
          ? and(eq(tripMembers.tripId, tripId), notInArray(tripMembers.id, keep))
          : eq(tripMembers.tripId, tripId)
      );

    for (const [i, m] of members.entries()) {
      const values = {
        tripId,
        name: m.name,
        email: m.email ?? null,
        sharePercent: m.sharePercent === null || m.sharePercent === undefined
          ? null
          : String(m.sharePercent),
        sortOrder: i,
      };
      if (m.id) {
        await tx.update(tripMembers).set(values).where(eq(tripMembers.id, m.id));
      } else {
        await tx.insert(tripMembers).values(values);
      }
    }
  });
}
