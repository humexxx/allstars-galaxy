import "server-only";

import { and, eq, inArray, isNull, max } from "drizzle-orm";
import type { z } from "zod";

import { db } from "@/db";
import {
  tripContributions,
  tripItemAttendees,
  tripItemPayers,
  tripItems,
  tripItemStops,
  tripMembers,
  tripPhotos,
  trips,
  tripShares,
} from "@/db/schema";
import { readUndo, signUndo } from "@/lib/travel/assistant/undo-token";
import { moneyRange } from "@/lib/travel/format";
import { allowsPriceUnit, deriveTitle, itemFields, spansDays } from "@/lib/travel/item-fields";
import { nextTripColor } from "@/lib/travel/trip-colors";
import { formatDayRange } from "@/lib/utils/date";
import {
  createTripSchema,
  tripContributionSchema,
  tripItemSchema,
  tripPhotoSchema,
  updateTripItemSchema,
  updateTripSchema,
  type TripItemData,
} from "@/schemas/travel";
import type { TravelChangeSetData } from "@/schemas/travel-assistant";
import type {
  AppliedTravelChanges,
  TravelChangeLine,
  TravelDaySpan,
  TripPreview,
} from "@/types/travel-assistant";
import type { TripItemCategory } from "@/types/travel";

import {
  getTripWithRelations,
  itemRowValues,
  loadTripWithRelations,
  listUserTrips,
  setItemMembers,
  tripRowValues,
  type Tx,
} from "./travel-service";

/**
 * The travel assistant's side of the database.
 *
 * Everything it writes goes through `runChanges`, once to preview a proposal
 * (inside a transaction that is then rolled back) and once to apply it. The
 * card the user approves is therefore what the database actually said, not a
 * guess at it — a bad date or someone else's trip fails at preview time.
 *
 * Only the caller's own trips are reachable: every read and write is scoped to
 * `userId`, exactly as the forms are.
 */

/** A refusal the model or the user should read — never a crash. */
export class TravelChangeError extends Error {}

type TripRow = typeof trips.$inferSelect;
type ItemRow = typeof tripItems.$inferSelect;
type MemberRow = typeof tripMembers.$inferSelect;
type PhotoRow = typeof tripPhotos.$inferSelect;
type ShareRow = typeof tripShares.$inferSelect;
type ContributionRow = typeof tripContributions.$inferSelect;
type MemberLinkRow = typeof tripItemPayers.$inferSelect;
type AttendeeRow = typeof tripItemAttendees.$inferSelect;

type ItemSnapshot = {
  item: ItemRow;
  stops: (typeof tripItemStops.$inferSelect)[];
  attendees: AttendeeRow[];
  payers: MemberLinkRow[];
  photos: (typeof tripPhotos.$inferSelect)[];
};

type TripSnapshot = {
  trip: TripRow;
  members: (typeof tripMembers.$inferSelect)[];
  items: ItemRow[];
  stops: (typeof tripItemStops.$inferSelect)[];
  attendees: AttendeeRow[];
  payers: MemberLinkRow[];
  photos: (typeof tripPhotos.$inferSelect)[];
  shares: (typeof tripShares.$inferSelect)[];
  contributions: (typeof tripContributions.$inferSelect)[];
};

/** The inverse of one applied change, run newest first by `undoTravelChanges`. */
type UndoOp =
  | { kind: "delete_trip"; tripId: string }
  | { kind: "restore_trip"; trip: TripRow }
  | { kind: "reinsert_trip"; snapshot: TripSnapshot }
  | { kind: "delete_item"; tripId: string; itemId: string }
  | { kind: "restore_item"; item: ItemRow; payers: MemberLinkRow[]; attendees: AttendeeRow[] }
  | { kind: "reinsert_item"; snapshot: ItemSnapshot }
  | { kind: "delete_member"; tripId: string; memberId: string }
  | { kind: "restore_member"; member: MemberRow }
  | {
      kind: "reinsert_member";
      member: MemberRow;
      attendees: AttendeeRow[];
      payers: MemberLinkRow[];
      contributions: ContributionRow[];
      /** Links scoped to them, as they were before removing them revoked them. */
      shares: Pick<ShareRow, "id" | "revokedAt">[];
    }
  | { kind: "delete_photo"; tripId: string; photoId: string }
  | { kind: "reinsert_photo"; photo: PhotoRow }
  | { kind: "delete_payment"; tripId: string; paymentId: string }
  | { kind: "restore_payment"; payment: ContributionRow }
  | { kind: "reinsert_payment"; payment: ContributionRow };

type RunResult = { lines: TravelChangeLine[]; undo: UndoOp[] };

const CATEGORY_LABEL: Record<TripItemCategory, string> = {
  lodging: "Hotel",
  flight: "Flight",
  cruise: "Cruise",
  transport: "Transport",
  food: "Food",
  activity: "Activity",
  shopping: "Shopping",
  other: "Other",
};

const UNIT_SUFFIX = { total: "", per_night: " / night", per_person: " / person" } as const;

// ---------- reads for the model ----------

export type AssistantTripSummary = Pick<
  TripRow,
  "id" | "title" | "destination" | "startDate" | "endDate" | "currency"
>;

export async function listAssistantTrips(userId: string): Promise<AssistantTripSummary[]> {
  const rows = await listUserTrips(userId);
  return rows.map(({ id, title, destination, startDate, endDate, currency }) => ({
    id,
    title,
    destination,
    startDate,
    endDate,
    currency,
  }));
}

/** One trip as the model reads it: what it needs to edit, and no more. */
export async function getAssistantTrip(userId: string, tripId: string): Promise<object | null> {
  const trip = await getTripWithRelations(tripId, userId);
  if (!trip) return null;
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    description: trip.description,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    coverPhotoUrl: trip.coverPhotoUrl,
    members: trip.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      sharePercent: m.sharePercent,
    })),
    photos: trip.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, itemId: p.itemId })),
    payments: trip.contributions.map((c) => ({
      id: c.id,
      memberId: c.memberId,
      amount: c.amount,
      paidOn: c.paidOn,
      note: c.note,
    })),
    items: trip.items.map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      scheduledOn: i.scheduledOn,
      endsOn: i.endsOn,
      fromCode: i.fromCode,
      toCode: i.toCode,
      roundTrip: i.roundTrip,
      price: i.price,
      priceMax: i.priceMax,
      priceUnit: i.priceUnit,
      link: i.link,
      notes: i.notes,
      attendeeIds: i.attendeeIds,
      payerIds: i.payerIds,
      ports: i.stops.map((s) => ({ day: s.dayNumber, on: s.stopOn, place: s.place })),
    })),
  };
}

// ---------- preview / apply / undo ----------

export type TravelChangePreview = { lines: TravelChangeLine[]; previews: TripPreview[] };

/** Thrown to roll a preview back while carrying its result out. */
class PreviewRollback extends Error {
  constructor(readonly result: TravelChangePreview) {
    super("preview");
  }
}

/**
 * What a proposal would do, without doing it: the card's lines, and each
 * touched trip as it would look — read inside the same transaction, before
 * it is rolled back, so the page draws what the database actually said.
 * Ids minted in here never exist; they only key the preview.
 */
export async function previewTravelChanges(
  userId: string,
  set: TravelChangeSetData
): Promise<TravelChangePreview> {
  try {
    await db.transaction(async (tx) => {
      const existing = [...new Set(set.changes.flatMap((c) => ("tripId" in c && c.tripId ? [c.tripId] : [])))];
      const before = new Map<string, NonNullable<Awaited<ReturnType<typeof loadTripWithRelations>>>>();
      for (const id of existing) {
        const trip = await loadTripWithRelations(tx, id, userId);
        if (trip) before.set(id, trip);
      }

      const { lines } = await runChanges(tx, userId, set);

      const created = lines.filter((l) => l.subject === "trip" && l.action === "add").map((l) => l.entityId!);
      const previews: TripPreview[] = [];
      for (const tripId of [...existing, ...created]) {
        const after = await loadTripWithRelations(tx, tripId, userId);
        previews.push(previewOf(tripId, before.get(tripId) ?? null, after, lines));
      }
      throw new PreviewRollback({ lines, previews });
    });
  } catch (err) {
    if (err instanceof PreviewRollback) return err.result;
    throw err;
  }
  throw new Error("unreachable");
}

function previewOf(
  tripId: string,
  before: TripPreview["before"],
  after: TripPreview["trip"],
  lines: TravelChangeLine[]
): TripPreview {
  const own = lines.filter((l) => l.tripId === tripId || l.entityId === tripId);
  const marks: TripPreview["marks"] = {};
  const fields: TripPreview["fields"] = {};
  for (const line of own) {
    if (!line.entityId) continue;
    marks[line.entityId] = line.action;
    if (line.fields) fields[line.entityId] = line.fields;
  }
  const gone = (id: string): boolean => marks[id] === "remove";
  const changed = (id: string): boolean => marks[id] === "change";
  return {
    tripId,
    trip: after,
    isNew: before === null && after !== null,
    marks,
    fields,
    itemsBefore: Object.fromEntries((before?.items ?? []).filter((i) => changed(i.id)).map((i) => [i.id, i])),
    removed: {
      items: (before?.items ?? []).filter((i) => gone(i.id)),
      members: (before?.members ?? []).filter((m) => gone(m.id)),
      photos: [...(before?.photos ?? []), ...(before?.items ?? []).flatMap((i) => i.photos)].filter((p) => gone(p.id)),
      payments: (before?.contributions ?? []).filter((c) => gone(c.id)),
    },
    before,
  };
}

export async function applyTravelChanges(
  userId: string,
  set: TravelChangeSetData
): Promise<AppliedTravelChanges> {
  const { lines, undo } = await db.transaction((tx) => runChanges(tx, userId, set));
  return { lines, undoToken: signUndo(userId, undo.reverse()) };
}

/** Puts back what one Apply did. All or nothing, like the Apply was. */
export async function undoTravelChanges(userId: string, token: string): Promise<void> {
  const ops = readUndo<UndoOp[]>(token, userId);
  if (!ops) throw new TravelChangeError("This change can no longer be undone");
  await db.transaction(async (tx) => {
    for (const op of ops) await runUndo(tx, userId, op);
  });
}

// ---------- the one write path ----------

async function runChanges(tx: Tx, userId: string, set: TravelChangeSetData): Promise<RunResult> {
  const lines: TravelChangeLine[] = [];
  const undo: UndoOp[] = [];
  const refs = new Map<string, string>();
  const usedColors = (await tx.select({ color: trips.color }).from(trips).where(eq(trips.userId, userId))).map(
    (r) => r.color
  );

  for (const [index, change] of set.changes.entries()) {
    const where = `Change ${index + 1} (${change.op})`;
    switch (change.op) {
      case "create_trip": {
        const color = nextTripColor(usedColors);
        usedColors.push(color);
        const data = valid(createTripSchema, { ...change.trip, color }, where);
        const [trip] = await tx.insert(trips).values({ userId, ...tripRowValues(data) }).returning();
        refs.set(change.ref, trip.id);
        undo.push({ kind: "delete_trip", tripId: trip.id });
        lines.push({
          action: "add",
          subject: "trip",
          tripTitle: trip.title,
          title: trip.title,
          detail: tripDetail(trip),
          tripId: trip.id,
          entityId: trip.id,
          after: tripSpan(trip),
        });
        break;
      }

      case "update_trip": {
        const current = await ownedTrip(tx, userId, change.tripId, where);
        const data = valid(updateTripSchema, { ...tripInput(current), ...change.changes, id: current.id }, where);
        const [trip] = await tx
          .update(trips)
          .set({ ...tripRowValues(data), updatedAt: new Date() })
          .where(and(eq(trips.id, current.id), eq(trips.userId, userId)))
          .returning();
        undo.push({ kind: "restore_trip", trip: current });
        lines.push({
          action: "change",
          subject: "trip",
          tripTitle: trip.title,
          title: trip.title,
          detail: tripDiff(current, trip),
          tripId: trip.id,
          entityId: trip.id,
          fields: changedFields(current, trip),
          before: tripSpan(current),
          after: tripSpan(trip),
          imageUrl: trip.coverPhotoUrl !== current.coverPhotoUrl ? (trip.coverPhotoUrl ?? undefined) : undefined,
        });
        break;
      }

      case "delete_trip": {
        const snapshot = await snapshotTrip(tx, userId, change.tripId, where);
        await tx.delete(trips).where(and(eq(trips.id, change.tripId), eq(trips.userId, userId)));
        undo.push({ kind: "reinsert_trip", snapshot });
        lines.push({
          action: "remove",
          subject: "trip",
          tripTitle: snapshot.trip.title,
          title: snapshot.trip.title,
          detail: `${tripDetail(snapshot.trip)} · ${count(snapshot.items.length, "item")}`,
          entityId: snapshot.trip.id,
          before: tripSpan(snapshot.trip),
        });
        break;
      }

      case "add_item": {
        const tripId = change.tripId ?? refs.get(change.tripRef ?? "");
        if (!tripId) throw new TravelChangeError(`${where}: no trip to add it to`);
        const trip = await ownedTrip(tx, userId, tripId, where);
        const item0 = await withNamedTravellers(tx, tripId, change.item, where);
        const data = itemData(valid(tripItemSchema, item0, where), where, true);
        const [item] = await tx
          .insert(tripItems)
          .values({ tripId, ...itemRowValues(data), sortOrder: 0 })
          .returning();
        await memberLists(tx, tripId, item.id, data, where);
        undo.push({ kind: "delete_item", tripId, itemId: item.id });
        lines.push({
          action: "add",
          subject: "item",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: item.title,
          category: item.category,
          detail: itemDetail(item, trip.currency),
          tripId,
          entityId: item.id,
          after: itemSpan(item),
        });
        break;
      }

      case "update_item": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const current = await tripItem(tx, trip.id, change.itemId, where);
        const [payers, attendees] = await itemLinks(tx, current.id);
        const merged = valid(
          updateTripItemSchema,
          {
            ...itemInput(current),
            payerIds: payers.map((p) => p.memberId),
            attendeeIds: attendees.map((a) => a.memberId),
            ...(await withNamedTravellers(tx, trip.id, change.changes, where)),
            id: current.id,
          },
          where
        );
        const touchedUnit = "priceUnit" in change.changes || "category" in change.changes;
        const data = itemData(merged, where, touchedUnit);
        const [item] = await tx
          .update(tripItems)
          .set({ ...itemRowValues(data), updatedAt: new Date() })
          .where(and(eq(tripItems.id, current.id), eq(tripItems.tripId, trip.id)))
          .returning();
        await setItemMembers(tripItemPayers, tx, trip.id, item.id, data.payerIds ?? []);
        await setItemMembers(tripItemAttendees, tx, trip.id, item.id, data.attendeeIds ?? []);
        undo.push({ kind: "restore_item", item: current, payers, attendees });
        lines.push({
          action: "change",
          subject: "item",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: item.title,
          category: item.category,
          detail: itemDiff(current, item, trip.currency),
          tripId: trip.id,
          entityId: item.id,
          fields: changedFields(current, item),
          before: itemSpan(current),
          after: itemSpan(item),
        });
        break;
      }

      case "delete_item": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const snapshot = await snapshotItem(tx, trip.id, change.itemId, where);
        await tx
          .delete(tripItems)
          .where(and(eq(tripItems.id, change.itemId), eq(tripItems.tripId, trip.id)));
        undo.push({ kind: "reinsert_item", snapshot });
        lines.push({
          action: "remove",
          subject: "item",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: snapshot.item.title,
          category: snapshot.item.category,
          detail: itemDetail(snapshot.item, trip.currency),
          tripId: trip.id,
          entityId: snapshot.item.id,
          before: itemSpan(snapshot.item),
        });
        break;
      }

      case "add_member": {
        const tripId = change.tripId ?? refs.get(change.tripRef ?? "");
        if (!tripId) throw new TravelChangeError(`${where}: no trip to add them to`);
        const trip = await ownedTrip(tx, userId, tripId, where);
        await checkShares(tx, tripId, change.member.sharePercent ?? null, null, where);
        const [{ last }] = await tx
          .select({ last: max(tripMembers.sortOrder) })
          .from(tripMembers)
          .where(eq(tripMembers.tripId, tripId));
        const [member] = await tx
          .insert(tripMembers)
          .values({
            tripId,
            name: change.member.name,
            email: change.member.email ?? null,
            sharePercent: shareValue(change.member.sharePercent),
            sortOrder: (last ?? -1) + 1,
          })
          .returning();
        undo.push({ kind: "delete_member", tripId, memberId: member.id });
        lines.push({
          action: "add",
          subject: "member",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: member.name,
          detail: memberDetail(member) || "Joins the trip",
          tripId,
          entityId: member.id,
        });
        break;
      }

      case "update_member": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const current = await tripMember(tx, trip.id, change.memberId, where);
        const next = { ...current, ...change.changes };
        if ("sharePercent" in change.changes) {
          await checkShares(tx, trip.id, change.changes.sharePercent ?? null, current.id, where);
        }
        const [member] = await tx
          .update(tripMembers)
          .set({
            name: next.name,
            email: next.email ?? null,
            sharePercent:
              "sharePercent" in change.changes ? shareValue(change.changes.sharePercent) : current.sharePercent,
          })
          .where(and(eq(tripMembers.id, current.id), eq(tripMembers.tripId, trip.id)))
          .returning();
        undo.push({ kind: "restore_member", member: current });
        lines.push({
          action: "change",
          subject: "member",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: member.name,
          detail:
            current.name !== member.name
              ? `Was "${current.name}"`
              : memberDetail(member) || "Details",
          tripId: trip.id,
          entityId: member.id,
        });
        break;
      }

      case "remove_member": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const member = await tripMember(tx, trip.id, change.memberId, where);
        const [attendees, payers, contributions, shares] = await Promise.all([
          tx.select().from(tripItemAttendees).where(eq(tripItemAttendees.memberId, member.id)),
          tx.select().from(tripItemPayers).where(eq(tripItemPayers.memberId, member.id)),
          tx.select().from(tripContributions).where(eq(tripContributions.memberId, member.id)),
          tx
            .select({ id: tripShares.id, revokedAt: tripShares.revokedAt })
            .from(tripShares)
            .where(eq(tripShares.memberId, member.id)),
        ]);
        // As setTripMembers does: the FK nulls a link's member, and a null
        // scope is the WHOLE trip. A link made to show one person their bill
        // must not start publishing everyone's.
        await tx
          .update(tripShares)
          .set({ revokedAt: new Date() })
          .where(and(eq(tripShares.memberId, member.id), isNull(tripShares.revokedAt)));
        await tx.delete(tripMembers).where(and(eq(tripMembers.id, member.id), eq(tripMembers.tripId, trip.id)));
        undo.push({ kind: "reinsert_member", member, attendees, payers, contributions, shares });
        lines.push({
          action: "remove",
          subject: "member",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: member.name,
          detail: contributions.length
            ? `Leaves the trip, with ${count(contributions.length, "payment")} they made`
            : "Leaves the trip",
          tripId: trip.id,
          entityId: member.id,
        });
        break;
      }

      case "add_photo": {
        const tripId = change.tripId ?? refs.get(change.tripRef ?? "");
        if (!tripId) throw new TravelChangeError(`${where}: no trip to add it to`);
        const trip = await ownedTrip(tx, userId, tripId, where);
        const item = change.photo.itemId ? await tripItem(tx, tripId, change.photo.itemId, where) : null;
        const data = valid(
          tripPhotoSchema,
          { ...change.photo, source: change.photo.storagePath ? "upload" : "url" },
          where
        );
        const [{ last }] = await tx
          .select({ last: max(tripPhotos.sortOrder) })
          .from(tripPhotos)
          .where(eq(tripPhotos.tripId, tripId));
        const [photo] = await tx
          .insert(tripPhotos)
          .values({
            tripId,
            itemId: item?.id ?? null,
            url: data.url,
            storagePath: data.storagePath ?? null,
            source: data.source,
            caption: data.caption ?? null,
            sortOrder: (last ?? -1) + 1,
          })
          .returning();
        undo.push({ kind: "delete_photo", tripId, photoId: photo.id });
        lines.push({
          action: "add",
          subject: "photo",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: photo.caption || (item ? `Photo of ${item.title}` : "Photo"),
          detail: item ? `On ${item.title}` : "In the gallery",
          imageUrl: photo.url,
          tripId,
          entityId: photo.id,
        });
        break;
      }

      case "add_payment": {
        const tripId = change.tripId ?? refs.get(change.tripRef ?? "");
        if (!tripId) throw new TravelChangeError(`${where}: no trip to log it on`);
        const trip = await ownedTrip(tx, userId, tripId, where);
        const memberId = change.payment.memberId
          ? (await tripMember(tx, tripId, change.payment.memberId, where)).id
          : idByName(await tripMemberNames(tx, tripId), change.payment.memberName ?? "", where);
        const data = valid(tripContributionSchema, { ...change.payment, memberId }, where);
        const [payment] = await tx
          .insert(tripContributions)
          .values({
            tripId,
            memberId,
            amount: data.amount,
            note: data.note ?? null,
            paidOn: data.paidOn ?? new Date().toISOString().slice(0, 10),
          })
          .returning();
        undo.push({ kind: "delete_payment", tripId, paymentId: payment.id });
        lines.push({
          action: "add",
          subject: "payment",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: await paymentTitle(tx, payment, trip.currency),
          detail: paymentDetail(payment),
          tripId,
          entityId: payment.id,
        });
        break;
      }

      case "update_payment": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const current = await tripPayment(tx, trip.id, change.paymentId, where);
        const data = valid(
          tripContributionSchema,
          {
            memberId: current.memberId,
            amount: current.amount,
            note: current.note,
            paidOn: current.paidOn,
            ...change.changes,
          },
          where
        );
        const [payment] = await tx
          .update(tripContributions)
          .set({ amount: data.amount, note: data.note ?? null, paidOn: data.paidOn ?? current.paidOn })
          .where(and(eq(tripContributions.id, current.id), eq(tripContributions.tripId, trip.id)))
          .returning();
        undo.push({ kind: "restore_payment", payment: current });
        lines.push({
          action: "change",
          subject: "payment",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: await paymentTitle(tx, payment, trip.currency),
          detail:
            current.amount !== payment.amount
              ? `Was ${moneyRange(Number(current.amount), Number(current.amount), trip.currency)}`
              : paymentDetail(payment),
          tripId: trip.id,
          entityId: payment.id,
          fields: changedFields(current, payment),
        });
        break;
      }

      case "remove_payment": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const payment = await tripPayment(tx, trip.id, change.paymentId, where);
        const title = await paymentTitle(tx, payment, trip.currency);
        await tx.delete(tripContributions).where(eq(tripContributions.id, payment.id));
        undo.push({ kind: "reinsert_payment", payment });
        lines.push({
          action: "remove",
          subject: "payment",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title,
          detail: paymentDetail(payment),
          tripId: trip.id,
          entityId: payment.id,
        });
        break;
      }

      case "remove_photo": {
        const trip = await ownedTrip(tx, userId, change.tripId, where);
        const [photo] = await tx
          .select()
          .from(tripPhotos)
          .where(and(eq(tripPhotos.id, change.photoId), eq(tripPhotos.tripId, trip.id)));
        if (!photo) throw new TravelChangeError(`${where}: photo not found on this trip`);
        // The row only: the uploaded file stays, so Undo has something to
        // point back at.
        await tx.delete(tripPhotos).where(eq(tripPhotos.id, photo.id));
        undo.push({ kind: "reinsert_photo", photo });
        lines.push({
          action: "remove",
          subject: "photo",
          tripTitle: trip.title,
          tripSpan: tripSpan(trip),
          title: photo.caption || "Photo",
          detail: "From the trip",
          imageUrl: photo.url,
          tripId: trip.id,
          entityId: photo.id,
        });
        break;
      }
    }
  }
  return { lines, undo };
}

async function runUndo(tx: Tx, userId: string, op: UndoOp): Promise<void> {
  switch (op.kind) {
    case "delete_trip":
      await tx.delete(trips).where(and(eq(trips.id, op.tripId), eq(trips.userId, userId)));
      return;

    case "restore_trip": {
      const before = revive(op.trip);
      const [row] = await tx
        .update(trips)
        .set({
          title: before.title,
          destination: before.destination,
          description: before.description,
          startDate: before.startDate,
          endDate: before.endDate,
          coverPhotoUrl: before.coverPhotoUrl,
          currency: before.currency,
          color: before.color,
          updatedAt: before.updatedAt,
        })
        .where(and(eq(trips.id, before.id), eq(trips.userId, userId)))
        .returning({ id: trips.id });
      if (!row) throw new TravelChangeError(`"${op.trip.title}" no longer exists`);
      return;
    }

    case "reinsert_trip": {
      const s = op.snapshot;
      if (s.trip.userId !== userId) throw new TravelChangeError("This change can no longer be undone");
      // Parents before children: members before anything that names one,
      // items before their stops, links and photos.
      await tx.insert(trips).values(revive(s.trip));
      await insertAll(tx, tripMembers, s.members);
      await insertAll(tx, tripItems, s.items);
      await insertAll(tx, tripItemStops, s.stops);
      await insertAll(tx, tripItemAttendees, s.attendees);
      await insertAll(tx, tripItemPayers, s.payers);
      await insertAll(tx, tripPhotos, s.photos);
      await insertAll(tx, tripShares, s.shares);
      await insertAll(tx, tripContributions, s.contributions);
      return;
    }

    case "delete_item": {
      // Gone with its trip already is as undone as it gets.
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, op.tripId), eq(trips.userId, userId)));
      if (!trip) return;
      await tx.delete(tripItems).where(and(eq(tripItems.id, op.itemId), eq(tripItems.tripId, trip.id)));
      return;
    }

    case "restore_item": {
      await ownedTrip(tx, userId, op.item.tripId, "Undo");
      const before = revive(op.item);
      const { id, tripId } = before;
      const [row] = await tx
        .update(tripItems)
        .set({
          title: before.title,
          category: before.category,
          link: before.link,
          videoUrl: before.videoUrl,
          fromCode: before.fromCode,
          toCode: before.toCode,
          roundTrip: before.roundTrip,
          price: before.price,
          priceMax: before.priceMax,
          priceUnit: before.priceUnit,
          scheduledOn: before.scheduledOn,
          endsOn: before.endsOn,
          notes: before.notes,
          sortOrder: before.sortOrder,
          updatedAt: before.updatedAt,
        })
        .where(and(eq(tripItems.id, id), eq(tripItems.tripId, tripId)))
        .returning({ id: tripItems.id });
      if (!row) throw new TravelChangeError(`"${op.item.title}" no longer exists`);
      await tx.delete(tripItemPayers).where(eq(tripItemPayers.itemId, id));
      await tx.delete(tripItemAttendees).where(eq(tripItemAttendees.itemId, id));
      await insertAll(tx, tripItemPayers, op.payers);
      await insertAll(tx, tripItemAttendees, op.attendees);
      return;
    }

    case "reinsert_item": {
      const s = op.snapshot;
      await ownedTrip(tx, userId, s.item.tripId, "Undo");
      await tx.insert(tripItems).values(revive(s.item));
      await insertAll(tx, tripItemStops, s.stops);
      await insertAll(tx, tripItemAttendees, s.attendees);
      await insertAll(tx, tripItemPayers, s.payers);
      await insertAll(tx, tripPhotos, s.photos);
      return;
    }

    case "delete_member": {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, op.tripId), eq(trips.userId, userId)));
      if (!trip) return;
      await tx.delete(tripMembers).where(and(eq(tripMembers.id, op.memberId), eq(tripMembers.tripId, trip.id)));
      return;
    }

    case "restore_member": {
      await ownedTrip(tx, userId, op.member.tripId, "Undo");
      const [row] = await tx
        .update(tripMembers)
        .set({ name: op.member.name, email: op.member.email, sharePercent: op.member.sharePercent })
        .where(and(eq(tripMembers.id, op.member.id), eq(tripMembers.tripId, op.member.tripId)))
        .returning({ id: tripMembers.id });
      if (!row) throw new TravelChangeError(`"${op.member.name}" is no longer on the trip`);
      return;
    }

    case "reinsert_member": {
      await ownedTrip(tx, userId, op.member.tripId, "Undo");
      await tx.insert(tripMembers).values(revive(op.member));
      await insertAll(tx, tripItemAttendees, op.attendees);
      await insertAll(tx, tripItemPayers, op.payers);
      await insertAll(tx, tripContributions, op.contributions);
      for (const share of op.shares) {
        await tx
          .update(tripShares)
          .set({ memberId: op.member.id, revokedAt: share.revokedAt ? new Date(share.revokedAt) : null })
          .where(and(eq(tripShares.id, share.id), eq(tripShares.tripId, op.member.tripId)));
      }
      return;
    }

    case "delete_photo": {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, op.tripId), eq(trips.userId, userId)));
      if (!trip) return;
      await tx.delete(tripPhotos).where(and(eq(tripPhotos.id, op.photoId), eq(tripPhotos.tripId, trip.id)));
      return;
    }

    case "reinsert_photo": {
      await ownedTrip(tx, userId, op.photo.tripId, "Undo");
      await tx.insert(tripPhotos).values(revive(op.photo));
      return;
    }

    case "delete_payment": {
      const [trip] = await tx
        .select({ id: trips.id })
        .from(trips)
        .where(and(eq(trips.id, op.tripId), eq(trips.userId, userId)));
      if (!trip) return;
      await tx
        .delete(tripContributions)
        .where(and(eq(tripContributions.id, op.paymentId), eq(tripContributions.tripId, trip.id)));
      return;
    }

    case "restore_payment": {
      await ownedTrip(tx, userId, op.payment.tripId, "Undo");
      const [row] = await tx
        .update(tripContributions)
        .set({ amount: op.payment.amount, note: op.payment.note, paidOn: op.payment.paidOn })
        .where(and(eq(tripContributions.id, op.payment.id), eq(tripContributions.tripId, op.payment.tripId)))
        .returning({ id: tripContributions.id });
      if (!row) throw new TravelChangeError("That payment is no longer on the trip");
      return;
    }

    case "reinsert_payment": {
      await ownedTrip(tx, userId, op.payment.tripId, "Undo");
      await tx.insert(tripContributions).values(revive(op.payment));
      return;
    }
  }
}

// ---------- helpers ----------

/** Zod's verdict as a sentence the model can act on. */
function valid<S extends z.ZodType>(schema: S, input: unknown, where: string): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue.path.length ? `${issue.path.join(".")}: ` : "";
  throw new TravelChangeError(`${where}: ${field}${issue.message}`);
}

/**
 * The rules the item form applies by construction: a flight's title is its
 * route, and a price is only per night where a night means something.
 */
function itemData<T extends TripItemData>(data: T, where: string, checkUnit: boolean): T {
  const unit = data.priceUnit ?? "total";
  if (checkUnit && !allowsPriceUnit(data.category, unit)) {
    throw new TravelChangeError(`${where}: a ${data.category} cannot be priced ${unit}`);
  }
  if (itemFields(data.category).title) return data;
  return { ...data, title: deriveTitle(data.category, data, data.title || CATEGORY_LABEL[data.category]) };
}

async function memberLists(tx: Tx, tripId: string, itemId: string, data: TripItemData, where: string): Promise<void> {
  try {
    if (data.payerIds?.length) await setItemMembers(tripItemPayers, tx, tripId, itemId, data.payerIds);
    if (data.attendeeIds?.length) await setItemMembers(tripItemAttendees, tx, tripId, itemId, data.attendeeIds);
  } catch {
    throw new TravelChangeError(`${where}: a traveller id is not on this trip`);
  }
}

async function tripMember(tx: Tx, tripId: string, memberId: string, where: string): Promise<MemberRow> {
  const [member] = await tx
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)));
  if (!member) throw new TravelChangeError(`${where}: traveller not found on this trip`);
  return member;
}

/**
 * Turns `attendeeNames` / `payerNames` into the ids the item schema takes.
 *
 * By name because the model reads names, and because a traveller added a
 * line earlier in the same proposal has no id it could know. A first name is
 * enough when only one member has it.
 */
async function withNamedTravellers<T extends { attendeeNames?: string[]; payerNames?: string[] }>(
  tx: Tx,
  tripId: string,
  fields: T,
  where: string
): Promise<Omit<T, "attendeeNames" | "payerNames"> & { attendeeIds?: string[]; payerIds?: string[] }> {
  const { attendeeNames, payerNames, ...rest } = fields;
  if (!attendeeNames && !payerNames) return rest;
  const members = await tripMemberNames(tx, tripId);
  const idFor = (name: string): string => idByName(members, name, where);
  return {
    ...rest,
    ...(attendeeNames ? { attendeeIds: attendeeNames.map(idFor) } : {}),
    ...(payerNames ? { payerIds: payerNames.map(idFor) } : {}),
  };
}

async function tripMemberNames(tx: Tx, tripId: string): Promise<{ id: string; name: string }[]> {
  return tx
    .select({ id: tripMembers.id, name: tripMembers.name })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));
}

/** A traveller by name: the whole name, or a first name nobody else shares. */
function idByName(members: { id: string; name: string }[], name: string, where: string): string {
  const wanted = name.trim().toLowerCase();
  const exact = members.filter((m) => m.name.trim().toLowerCase() === wanted);
  const first = members.filter((m) => m.name.trim().toLowerCase().split(/\s+/)[0] === wanted);
  const match = exact.length === 1 ? exact : first;
  if (match.length !== 1) {
    throw new TravelChangeError(
      `${where}: no single traveller called "${name}" (on this trip: ${members.map((m) => m.name).join(", ") || "nobody yet"})`
    );
  }
  return match[0].id;
}

async function tripPayment(tx: Tx, tripId: string, paymentId: string, where: string): Promise<ContributionRow> {
  const [payment] = await tx
    .select()
    .from(tripContributions)
    .where(and(eq(tripContributions.id, paymentId), eq(tripContributions.tripId, tripId)));
  if (!payment) throw new TravelChangeError(`${where}: payment not found on this trip`);
  return payment;
}

async function paymentTitle(tx: Tx, p: ContributionRow, currency: string): Promise<string> {
  const [member] = await tx
    .select({ name: tripMembers.name })
    .from(tripMembers)
    .where(eq(tripMembers.id, p.memberId));
  const amount = Number(p.amount);
  return `${member?.name ?? "Someone"} paid ${moneyRange(amount, amount, currency)}`;
}

function paymentDetail(p: ContributionRow): string {
  return [p.paidOn ? formatDayRange(p.paidOn) : null, p.note].filter(Boolean).join(" · ");
}

/** The columns that differ between two versions of one row, timestamps aside. */
function changedFields<T extends object>(before: T, after: T): string[] {
  const skip = new Set(["updatedAt", "createdAt"]);
  return Object.keys(after).filter(
    (k) => !skip.has(k) && String((before as Record<string, unknown>)[k]) !== String((after as Record<string, unknown>)[k])
  );
}

/** Fixed shares may total less than 100 (the rest splits equally), never more. */
async function checkShares(
  tx: Tx,
  tripId: string,
  share: number | null,
  replacing: string | null,
  where: string
): Promise<void> {
  if (share === null) return;
  const members = await tx
    .select({ id: tripMembers.id, sharePercent: tripMembers.sharePercent })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));
  const others = members
    .filter((m) => m.id !== replacing && m.sharePercent !== null)
    .reduce((sum, m) => sum + Number(m.sharePercent), 0);
  if (others + share > 100.001) {
    throw new TravelChangeError(`${where}: fixed shares would add up to ${others + share}%, more than 100%`);
  }
}

function shareValue(share: number | null | undefined): string | null {
  return share === null || share === undefined ? null : String(share);
}

function memberDetail(m: MemberRow): string {
  return [m.email, m.sharePercent !== null ? `${Number(m.sharePercent)}% of the cost` : null]
    .filter(Boolean)
    .join(" · ");
}

function tripSpan(t: Pick<TripRow, "startDate" | "endDate">): TravelDaySpan {
  return { from: t.startDate, to: t.endDate ?? t.startDate };
}

/** What the item occupies on a calendar: a return flight is its day out. */
function itemSpan(i: Pick<ItemRow, "scheduledOn" | "endsOn" | "category">): TravelDaySpan | null {
  if (!i.scheduledOn) return null;
  const to = i.endsOn && spansDays(i.category) ? i.endsOn : i.scheduledOn;
  return { from: i.scheduledOn, to };
}

async function ownedTrip(tx: Tx, userId: string, tripId: string, where: string): Promise<TripRow> {
  const [trip] = await tx.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.userId, userId)));
  if (!trip) throw new TravelChangeError(`${where}: trip not found`);
  return trip;
}

async function tripItem(tx: Tx, tripId: string, itemId: string, where: string): Promise<ItemRow> {
  const [item] = await tx
    .select()
    .from(tripItems)
    .where(and(eq(tripItems.id, itemId), eq(tripItems.tripId, tripId)));
  if (!item) throw new TravelChangeError(`${where}: item not found on this trip`);
  return item;
}

async function itemLinks(tx: Tx, itemId: string): Promise<[MemberLinkRow[], AttendeeRow[]]> {
  return Promise.all([
    tx.select().from(tripItemPayers).where(eq(tripItemPayers.itemId, itemId)),
    tx.select().from(tripItemAttendees).where(eq(tripItemAttendees.itemId, itemId)),
  ]);
}

async function snapshotItem(tx: Tx, tripId: string, itemId: string, where: string): Promise<ItemSnapshot> {
  const item = await tripItem(tx, tripId, itemId, where);
  const [payers, attendees] = await itemLinks(tx, item.id);
  const [stops, photos] = await Promise.all([
    tx.select().from(tripItemStops).where(eq(tripItemStops.itemId, item.id)),
    tx.select().from(tripPhotos).where(eq(tripPhotos.itemId, item.id)),
  ]);
  return { item, stops, attendees, payers, photos };
}

async function snapshotTrip(tx: Tx, userId: string, tripId: string, where: string): Promise<TripSnapshot> {
  const trip = await ownedTrip(tx, userId, tripId, where);
  const [members, items, photos, shares, contributions] = await Promise.all([
    tx.select().from(tripMembers).where(eq(tripMembers.tripId, trip.id)),
    tx.select().from(tripItems).where(eq(tripItems.tripId, trip.id)),
    tx.select().from(tripPhotos).where(eq(tripPhotos.tripId, trip.id)),
    tx.select().from(tripShares).where(eq(tripShares.tripId, trip.id)),
    tx.select().from(tripContributions).where(eq(tripContributions.tripId, trip.id)),
  ]);
  const itemIds = items.map((i) => i.id);
  const [stops, attendees, payers] = itemIds.length
    ? await Promise.all([
        tx.select().from(tripItemStops).where(inArray(tripItemStops.itemId, itemIds)),
        tx.select().from(tripItemAttendees).where(inArray(tripItemAttendees.itemId, itemIds)),
        tx.select().from(tripItemPayers).where(inArray(tripItemPayers.itemId, itemIds)),
      ])
    : [[], [], []];
  return { trip, members, items, stops, attendees, payers, photos, shares, contributions };
}

/** Rows come back from the signed receipt as JSON: timestamps are strings again. */
const TIMESTAMPS = ["createdAt", "updatedAt", "expiresAt", "revokedAt"] as const;

export function revive<T extends object>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const key of TIMESTAMPS) {
    if (typeof out[key] === "string") out[key] = new Date(out[key] as string);
  }
  return out as T;
}

async function insertAll(
  tx: Tx,
  table:
    | typeof tripMembers
    | typeof tripItems
    | typeof tripItemStops
    | typeof tripItemAttendees
    | typeof tripItemPayers
    | typeof tripPhotos
    | typeof tripShares
    | typeof tripContributions,
  rows: object[]
): Promise<void> {
  if (rows.length === 0) return;
  // The union of tables makes `values` uninferrable; every row came out of
  // the same table it goes back into.
  await tx.insert(table).values(rows.map(revive) as never);
}

function tripInput(t: TripRow): Record<string, unknown> {
  return {
    title: t.title,
    destination: t.destination,
    description: t.description,
    startDate: t.startDate,
    endDate: t.endDate,
    coverPhotoUrl: t.coverPhotoUrl,
    currency: t.currency,
    color: t.color,
  };
}

function itemInput(i: ItemRow): Record<string, unknown> {
  return {
    title: i.title,
    category: i.category,
    link: i.link,
    videoUrl: i.videoUrl,
    fromCode: i.fromCode,
    toCode: i.toCode,
    roundTrip: i.roundTrip,
    price: i.price,
    priceMax: i.priceMax,
    priceUnit: i.priceUnit,
    scheduledOn: i.scheduledOn,
    endsOn: i.endsOn,
    notes: i.notes,
  };
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function tripDetail(t: Pick<TripRow, "startDate" | "endDate" | "destination">): string {
  const dates = formatDayRange(t.startDate, t.endDate);
  return t.destination ? `${dates} · ${t.destination}` : dates;
}

function itemPrice(i: Pick<ItemRow, "price" | "priceMax" | "priceUnit">, currency: string): string | null {
  if (i.price === null) return null;
  const low = Number(i.price);
  const high = i.priceMax === null ? low : Number(i.priceMax);
  return `${moneyRange(low, high, currency)}${UNIT_SUFFIX[i.priceUnit]}`;
}

function itemDates(i: Pick<ItemRow, "scheduledOn" | "endsOn">): string {
  return i.scheduledOn ? formatDayRange(i.scheduledOn, i.endsOn) : "No date";
}

function itemDetail(i: ItemRow, currency: string): string {
  return [itemDates(i), itemPrice(i, currency)].filter(Boolean).join(" · ");
}

function tripDiff(before: TripRow, after: TripRow): string {
  const parts: string[] = [];
  if (before.title !== after.title) parts.push(`Renamed from "${before.title}"`);
  if (before.startDate !== after.startDate || before.endDate !== after.endDate) {
    parts.push(`${formatDayRange(before.startDate, before.endDate)} → ${formatDayRange(after.startDate, after.endDate)}`);
  }
  if (before.destination !== after.destination) parts.push(`Destination ${after.destination ?? "cleared"}`);
  if (before.currency !== after.currency) parts.push(`Currency ${before.currency} → ${after.currency}`);
  if (before.description !== after.description) parts.push("Description");
  if (before.coverPhotoUrl !== after.coverPhotoUrl) parts.push(after.coverPhotoUrl ? "New cover photo" : "Cover photo removed");
  return parts.join(" · ") || "No visible change";
}

function itemDiff(before: ItemRow, after: ItemRow, currency: string): string {
  const parts: string[] = [];
  if (before.title !== after.title) parts.push(`Was "${before.title}"`);
  if (before.category !== after.category) parts.push(`${CATEGORY_LABEL[before.category]} → ${CATEGORY_LABEL[after.category]}`);
  if (before.scheduledOn !== after.scheduledOn || before.endsOn !== after.endsOn) {
    parts.push(`${itemDates(before)} → ${itemDates(after)}`);
  }
  const was = itemPrice(before, currency);
  const now = itemPrice(after, currency);
  if (was !== now) parts.push(`${was ?? "No price"} → ${now ?? "no price"}`);
  if (before.fromCode !== after.fromCode || before.toCode !== after.toCode || before.roundTrip !== after.roundTrip) {
    parts.push("Route");
  }
  if (before.notes !== after.notes) parts.push("Notes");
  if (before.link !== after.link) parts.push("Link");
  return parts.join(" · ") || "Travellers";
}
