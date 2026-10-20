import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Queue-backed Drizzle chains, as in travel-service.test.ts: each select /
// insert / update / delete resolves to the next scripted rows, and the
// arguments each chain was built with are recorded. A transaction runs its
// callback against the same object, so a preview's rollback is the callback
// throwing — which is exactly what Drizzle rethrows.

const selects: unknown[][] = [];
const inserts: unknown[][] = [];
const updates: unknown[][] = [];
const calls = {
  insert: [] as { table: unknown; values: unknown }[],
  update: [] as { table: unknown; set: unknown }[],
  delete: [] as unknown[],
};

function chain(rows: unknown[], record?: (method: string, arg: unknown) => void) {
  const c: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "values", "set"]) {
    c[method] = vi.fn((arg: unknown) => {
      record?.(method, arg);
      return c;
    });
  }
  c.returning = vi.fn(() => Promise.resolve(rows));
  c.then = (ok: (r: unknown[]) => unknown, fail?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(ok, fail);
  return c;
}

vi.mock("@/db", () => {
  const db = {
    select: vi.fn(() => chain(selects.shift() ?? [])),
    insert: vi.fn((table: unknown) =>
      chain(inserts.shift() ?? [], (m, arg) => m === "values" && calls.insert.push({ table, values: arg }))
    ),
    update: vi.fn((table: unknown) =>
      chain(updates.shift() ?? [], (m, arg) => m === "set" && calls.update.push({ table, set: arg }))
    ),
    delete: vi.fn((table: unknown) => {
      calls.delete.push(table);
      return chain([]);
    }),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };
  return { db };
});

vi.mock("@/lib/services/travel-service", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/services/travel-service")>()),
  setItemMembers: vi.fn(async () => undefined),
}));

import { trips, tripItems, tripMembers, tripItemStops, tripPhotos, tripShares } from "@/db/schema";
import { readUndo, signUndo } from "@/lib/travel/assistant/undo-token";
import { setItemMembers } from "@/lib/services/travel-service";

import {
  applyTravelChanges,
  previewTravelChanges,
  TravelChangeError,
  undoTravelChanges,
} from "./travel-assistant-service";

const USER = "11111111-1111-4111-8111-111111111111";
const TRIP = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const MEMBER = "44444444-4444-4444-8444-444444444444";

const tripRow = (over: Record<string, unknown> = {}) => ({
  id: TRIP, userId: USER, title: "Orlando", destination: "Orlando, Florida", description: null,
  startDate: "2027-01-16", endDate: "2027-01-24", coverPhotoUrl: null, currency: "USD",
  color: "var(--chart-1)", createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"), ...over,
});

const itemRow = (over: Record<string, unknown> = {}) => ({
  id: ITEM, tripId: TRIP, title: "Universal Studios", category: "activity", link: null,
  videoUrl: null, fromCode: null, toCode: null, roundTrip: false, price: "400.00",
  priceMax: null, priceUnit: "total", scheduledOn: "2027-01-18", endsOn: "2027-01-19",
  notes: null, sortOrder: 0, createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"), ...over,
});

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  process.env.CRON_SECRET = "a-test-secret-long-enough";
});

afterEach(() => {
  selects.length = 0;
  inserts.length = 0;
  updates.length = 0;
  calls.insert.length = 0;
  calls.update.length = 0;
  calls.delete.length = 0;
  vi.clearAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("applyTravelChanges", () => {
  it("creates a trip and its items in one go, on the first free colour", async () => {
    selects.push([{ color: "var(--chart-1)" }], [tripRow({ color: "var(--chart-2)" })]);
    inserts.push([tripRow({ color: "var(--chart-2)" })], [itemRow()]);

    const applied = await applyTravelChanges(USER, {
      summary: "Orlando",
      changes: [
        { op: "create_trip", ref: "orl", trip: { title: "Orlando", startDate: "2027-01-16", endDate: "2027-01-24" } },
        { op: "add_item", tripRef: "orl", item: { title: "Universal Studios", category: "activity", scheduledOn: "2027-01-18", endsOn: "2027-01-19", price: "400.00" } },
      ],
    });

    expect(calls.insert[0]).toMatchObject({
      table: trips,
      values: { userId: USER, title: "Orlando", color: "var(--chart-2)", currency: "USD" },
    });
    // The item lands on the trip the ref named, created a line earlier.
    expect(calls.insert[1]).toMatchObject({ table: tripItems, values: { tripId: TRIP, price: "400.00" } });
    expect(applied.lines.map((l) => [l.action, l.subject, l.title])).toEqual([
      ["add", "trip", "Orlando"],
      ["add", "item", "Universal Studios"],
    ]);
    // Undo runs newest first: the item, then the trip.
    expect(readUndo(applied.undoToken!, USER)).toEqual([
      { kind: "delete_item", tripId: TRIP, itemId: ITEM },
      { kind: "delete_trip", tripId: TRIP },
    ]);
  });

  it("refuses a trip that is not the user's", async () => {
    selects.push([], []);
    await expect(
      applyTravelChanges(USER, {
        summary: "Rename",
        changes: [{ op: "update_trip", tripId: TRIP, changes: { title: "Mine now" } }],
      })
    ).rejects.toThrow(new TravelChangeError("Change 1 (update_trip): trip not found"));
    expect(calls.update).toHaveLength(0);
  });

  it("merges an item's patch over what is stored, keeping who it is for", async () => {
    selects.push([], [tripRow()], [itemRow()], [{ itemId: ITEM, memberId: MEMBER, sharePercent: null }], [
      { itemId: ITEM, memberId: MEMBER },
    ]);
    updates.push([itemRow({ price: "450.00" })]);

    const applied = await applyTravelChanges(USER, {
      summary: "Dearer tickets",
      changes: [{ op: "update_item", tripId: TRIP, itemId: ITEM, changes: { price: "450.00" } }],
    });

    expect(calls.update[0].set).toMatchObject({
      title: "Universal Studios",
      price: "450.00",
      scheduledOn: "2027-01-18",
      endsOn: "2027-01-19",
    });
    // Not named in the patch, so not cleared: the service replaces both lists.
    expect(setItemMembers).toHaveBeenCalledWith(expect.anything(), expect.anything(), TRIP, ITEM, [MEMBER]);
    expect(applied.lines[0].detail).toBe("$400 → $450");
  });

  it("names the field when the merged item is invalid", async () => {
    selects.push([], [tripRow()], [itemRow()], [], []);
    await expect(
      applyTravelChanges(USER, {
        summary: "Backwards",
        changes: [{ op: "update_item", tripId: TRIP, itemId: ITEM, changes: { endsOn: "2027-01-10" } }],
      })
    ).rejects.toThrow(/endsOn: End day must be on or after the start day/);
  });

  it("titles a flight by its route, as the form does", async () => {
    selects.push([], [tripRow()]);
    inserts.push([itemRow({ category: "flight", title: "SJO ⇄ MCO" })]);
    await applyTravelChanges(USER, {
      summary: "Flights",
      changes: [{ op: "add_item", tripId: TRIP, item: { title: "Flights to Orlando", category: "flight", fromCode: "SJO", toCode: "MCO", roundTrip: true, scheduledOn: "2027-01-16", endsOn: "2027-01-24" } }],
    });
    expect(calls.insert[0].values).toMatchObject({ title: "SJO ⇄ MCO", roundTrip: true });
  });

  it("will not price a flight per night", async () => {
    selects.push([], [tripRow()]);
    await expect(
      applyTravelChanges(USER, {
        summary: "Flights",
        changes: [{ op: "add_item", tripId: TRIP, item: { title: "SJO → MCO", category: "flight", price: "450.00", priceUnit: "per_night" } }],
      })
    ).rejects.toThrow(/a flight cannot be priced per_night/);
  });
});

describe("travellers and photos", () => {
  const NEW_MEMBER = "55555555-5555-4555-8555-555555555555";
  const member = (over: Record<string, unknown> = {}) => ({
    id: NEW_MEMBER, tripId: TRIP, name: "Ana", email: null, sharePercent: null, sortOrder: 2,
    createdAt: new Date("2026-10-19T00:00:00Z"), ...over,
  });

  it("adds a traveller and splits a new day between two people named in the same proposal", async () => {
    selects.push(
      [], // colours
      [tripRow()], // add_member: the trip
      [{ last: 1 }], // its last member's place
      [tripRow()], // add_item: the trip
      [
        { id: MEMBER, name: "Jason Hume" },
        { id: NEW_MEMBER, name: "Ana" },
      ] // the members, Ana included
    );
    inserts.push([member()], [itemRow({ title: "Islands of Adventure", priceUnit: "per_person" })]);

    const applied = await applyTravelChanges(USER, {
      summary: "Theme park day",
      changes: [
        { op: "add_member", tripId: TRIP, member: { name: "Ana" } },
        {
          op: "add_item",
          tripId: TRIP,
          item: {
            title: "Islands of Adventure",
            category: "activity",
            scheduledOn: "2027-01-18",
            price: "180.00",
            priceUnit: "per_person",
            attendeeNames: ["Jason", "Ana"],
            payerNames: ["jason hume", "Ana"],
          },
        },
      ],
    });

    expect(calls.insert[0]).toMatchObject({ table: tripMembers, values: { name: "Ana", sortOrder: 2 } });
    // Named, then resolved to the ids the item's lists take — a first name
    // is enough when it is the only one.
    expect(setItemMembers).toHaveBeenCalledWith(expect.anything(), expect.anything(), TRIP, ITEM, [MEMBER, NEW_MEMBER]);
    expect(applied.lines.map((l) => [l.subject, l.title])).toEqual([
      ["member", "Ana"],
      ["item", "Islands of Adventure"],
    ]);
    expect(applied.lines[1].after).toEqual({ from: "2027-01-18", to: "2027-01-19" });
  });

  it("says who is on the trip when a name matches nobody", async () => {
    selects.push([], [tripRow()], [{ id: MEMBER, name: "Jason Hume" }]);
    await expect(
      applyTravelChanges(USER, {
        summary: "x",
        changes: [{ op: "add_item", tripId: TRIP, item: { title: "Dinner", category: "food", payerNames: ["Bruno"] } }],
      })
    ).rejects.toThrow('no single traveller called "Bruno" (on this trip: Jason Hume)');
  });

  it("removes a traveller, revoking links scoped to them, and can put it all back", async () => {
    const share = { id: "66666666-6666-4666-8666-666666666666", revokedAt: null };
    selects.push(
      [],
      [tripRow()],
      [member()],
      [{ id: "a", itemId: ITEM, memberId: NEW_MEMBER }], // attendees
      [], // payers
      [], // contributions
      [share]
    );
    const applied = await applyTravelChanges(USER, {
      summary: "Ana is out",
      changes: [{ op: "remove_member", tripId: TRIP, memberId: NEW_MEMBER }],
    });
    expect(calls.update[0]).toMatchObject({ table: tripShares, set: { revokedAt: expect.any(Date) } });
    expect(calls.delete).toContain(tripMembers);

    calls.insert.length = 0;
    calls.update.length = 0;
    selects.push([tripRow()]);
    await undoTravelChanges(USER, applied.undoToken!);
    expect(calls.insert.map((c) => c.table)).toEqual([tripMembers, expect.anything()]);
    expect(calls.update[0]).toMatchObject({ table: tripShares, set: { memberId: NEW_MEMBER, revokedAt: null } });
  });

  it("adds an attached picture to the gallery as an upload", async () => {
    const url = "https://x.supabase.co/storage/v1/object/public/trip-photos/u/assistant/a.jpg";
    selects.push([], [tripRow()], [{ last: null }]);
    inserts.push([{ id: "p1", tripId: TRIP, itemId: null, url, caption: null }]);
    const applied = await applyTravelChanges(USER, {
      summary: "Photo",
      changes: [
        {
          op: "add_photo",
          tripId: TRIP,
          photo: { url, storagePath: "11111111-1111-4111-8111-111111111111/assistant/a.jpg" },
        },
      ],
    });
    expect(calls.insert[0]).toMatchObject({ table: tripPhotos, values: { source: "upload", sortOrder: 0 } });
    expect(applied.lines[0]).toMatchObject({ subject: "photo", imageUrl: url, detail: "In the gallery" });
  });
});

describe("previewTravelChanges", () => {
  it("returns what would happen and keeps none of it", async () => {
    selects.push([], [tripRow()]);
    inserts.push([itemRow()]);
    const lines = await previewTravelChanges(USER, {
      summary: "Tickets",
      changes: [{ op: "add_item", tripId: TRIP, item: { title: "Universal Studios", category: "activity" } }],
    });
    expect(lines).toEqual([
      expect.objectContaining({ action: "add", title: "Universal Studios", tripTitle: "Orlando", tripId: undefined }),
    ]);
  });
});

describe("undoTravelChanges", () => {
  it("refuses a receipt it did not sign", async () => {
    await expect(undoTravelChanges(USER, "forged.token")).rejects.toThrow(TravelChangeError);
  });

  it("refuses somebody else's receipt", async () => {
    const token = signUndo("55555555-5555-4555-8555-555555555555", [{ kind: "delete_trip", tripId: TRIP }])!;
    await expect(undoTravelChanges(USER, token)).rejects.toThrow(TravelChangeError);
    expect(calls.delete).toHaveLength(0);
  });

  it("puts a deleted trip back, parents before children", async () => {
    const snapshot = JSON.parse(
      JSON.stringify({
        trip: tripRow(),
        members: [{ id: MEMBER, tripId: TRIP, name: "Ana", email: null, sharePercent: null, sortOrder: 0, createdAt: new Date() }],
        items: [itemRow()],
        stops: [{ id: "s", itemId: ITEM, dayNumber: 1, stopOn: null, place: "At sea", note: null, createdAt: new Date() }],
        attendees: [],
        payers: [],
        photos: [{ id: "p", tripId: TRIP, itemId: null, url: "https://x.test/a.jpg", storagePath: null, source: "url", caption: null, sortOrder: 0, createdAt: new Date() }],
        shares: [],
        contributions: [],
      })
    );
    const token = signUndo(USER, [{ kind: "reinsert_trip", snapshot }])!;

    await undoTravelChanges(USER, token);

    expect(calls.insert.map((c) => c.table)).toEqual([trips, tripMembers, tripItems, tripItemStops, tripPhotos]);
    // JSON turned the timestamps into strings; they go back in as dates.
    expect((calls.insert[0].values as { createdAt: unknown }).createdAt).toBeInstanceOf(Date);
  });
});
