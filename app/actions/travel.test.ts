import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/travel-service", () => ({
  addTripItem: vi.fn(),
  addTripPhoto: vi.fn(),
  createTrip: vi.fn(),
  createTripShare: vi.fn(),
  deleteTrip: vi.fn(),
  deleteTripItem: vi.fn(),
  deleteTripPhoto: vi.fn(),
  deleteTripShare: vi.fn(),
  revokeTripShare: vi.fn(),
  updateTrip: vi.fn(),
  updateTripItem: vi.fn(),
}));

import { revalidatePath } from "next/cache";
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
  addTripItemAction,
  addTripPhotoAction,
  createTripAction,
  createTripShareAction,
  deleteTripAction,
  deleteTripItemAction,
  deleteTripPhotoAction,
  deleteTripShareAction,
  revokeTripShareAction,
  updateTripAction,
  updateTripItemAction,
} from "./travel";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";
const SHARE_ID = "44444444-4444-4444-8444-444444444444";

const TRIP_LIST_PATH = "/portal/entertainment/travel-planner";
const tripPath = (id: string) => `${TRIP_LIST_PATH}/${id}`;

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    realUser: { id: USER_ID } as never,
    realRole: "user",
    impersonatedUser: null,
    effectiveUserId: USER_ID,
    isImpersonating: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createTripAction", () => {
  it("creates the trip, logs the mutation, and revalidates the list path", async () => {
    const trip = { id: TRIP_ID, title: "Tokyo" } as unknown as Awaited<
      ReturnType<typeof createTrip>
    >;
    vi.mocked(createTrip).mockResolvedValueOnce(trip);

    const result = await createTripAction({
      title: "Tokyo",
      startDate: "2026-06-01",
      currency: "USD",
      color: "var(--chart-1)",
    } as unknown as Parameters<typeof createTripAction>[0]);

    expect(result).toEqual({ success: true, data: trip });
    expect(createTrip).toHaveBeenCalledOnce();
    expect(createTrip).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: "Tokyo", startDate: "2026-06-01" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledOnce();
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trip.create",
        entityTable: "trips",
        entityId: TRIP_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(TRIP_LIST_PATH);
  });

  it("returns an error envelope and does not call the service when title is missing", async () => {
    const result = await createTripAction({
      startDate: "2026-06-01",
    } as unknown as Parameters<typeof createTripAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createTrip).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateTripAction", () => {
  it("updates the trip and revalidates both list + detail paths", async () => {
    const trip = { id: TRIP_ID, title: "Kyoto" } as unknown as Awaited<
      ReturnType<typeof updateTrip>
    >;
    vi.mocked(updateTrip).mockResolvedValueOnce(trip);

    const result = await updateTripAction({
      id: TRIP_ID,
      title: "Kyoto",
      startDate: "2026-07-01",
      currency: "USD",
      color: "var(--chart-1)",
    } as unknown as Parameters<typeof updateTripAction>[0]);

    expect(result).toEqual({ success: true, data: trip });
    expect(updateTrip).toHaveBeenCalledOnce();
    expect(updateTrip).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ id: TRIP_ID, title: "Kyoto" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trip.update",
        entityTable: "trips",
        entityId: TRIP_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(TRIP_LIST_PATH);
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });

  it("rejects payloads with a non-uuid id", async () => {
    const result = await updateTripAction({
      id: "not-a-uuid",
      title: "Kyoto",
      startDate: "2026-07-01",
    } as unknown as Parameters<typeof updateTripAction>[0]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updateTrip).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteTripAction", () => {
  it("deletes the trip on a valid uuid", async () => {
    vi.mocked(deleteTrip).mockResolvedValueOnce(undefined as never);

    const result = await deleteTripAction(TRIP_ID);

    expect(result).toEqual({ success: true });
    expect(deleteTrip).toHaveBeenCalledOnce();
    expect(deleteTrip).toHaveBeenCalledWith(USER_ID, TRIP_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trip.delete",
        entityTable: "trips",
        entityId: TRIP_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(TRIP_LIST_PATH);
  });

  it("returns an error for a non-uuid id and skips the service", async () => {
    const result = await deleteTripAction("not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid id" });
    expect(deleteTrip).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addTripItemAction", () => {
  it("adds the item, logs, and revalidates the trip detail path", async () => {
    const row = { id: ITEM_ID, title: "Hotel" } as unknown as Awaited<
      ReturnType<typeof addTripItem>
    >;
    vi.mocked(addTripItem).mockResolvedValueOnce(row);

    const result = await addTripItemAction(TRIP_ID, {
      title: "Hotel",
      category: "lodging",
    } as unknown as Parameters<typeof addTripItemAction>[1]);

    expect(result).toEqual({ success: true, data: row });
    expect(addTripItem).toHaveBeenCalledOnce();
    expect(addTripItem).toHaveBeenCalledWith(
      USER_ID,
      TRIP_ID,
      expect.objectContaining({ title: "Hotel", category: "lodging" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripItem.create",
        entityTable: "trip_items",
        entityId: ITEM_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });

  it("rejects when tripId is not a uuid", async () => {
    const result = await addTripItemAction("nope", {
      title: "Hotel",
    } as unknown as Parameters<typeof addTripItemAction>[1]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(addTripItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects when item input is missing required title", async () => {
    const result = await addTripItemAction(TRIP_ID, {
      category: "lodging",
    } as unknown as Parameters<typeof addTripItemAction>[1]);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(addTripItem).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateTripItemAction", () => {
  it("updates the item on valid input", async () => {
    const row = { id: ITEM_ID, title: "Hotel v2" } as unknown as Awaited<
      ReturnType<typeof updateTripItem>
    >;
    vi.mocked(updateTripItem).mockResolvedValueOnce(row);

    const result = await updateTripItemAction(TRIP_ID, {
      id: ITEM_ID,
      title: "Hotel v2",
      category: "lodging",
    } as unknown as Parameters<typeof updateTripItemAction>[1]);

    expect(result).toEqual({ success: true, data: row });
    expect(updateTripItem).toHaveBeenCalledOnce();
    expect(updateTripItem).toHaveBeenCalledWith(
      USER_ID,
      TRIP_ID,
      expect.objectContaining({ id: ITEM_ID, title: "Hotel v2" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripItem.update",
        entityTable: "trip_items",
        entityId: ITEM_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});

describe("deleteTripItemAction", () => {
  it("deletes when both ids are valid uuids", async () => {
    vi.mocked(deleteTripItem).mockResolvedValueOnce(undefined as never);

    const result = await deleteTripItemAction(TRIP_ID, ITEM_ID);

    expect(result).toEqual({ success: true });
    expect(deleteTripItem).toHaveBeenCalledOnce();
    expect(deleteTripItem).toHaveBeenCalledWith(USER_ID, TRIP_ID, ITEM_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripItem.delete",
        entityTable: "trip_items",
        entityId: ITEM_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });

  it("rejects when either id is not a uuid", async () => {
    const result = await deleteTripItemAction(TRIP_ID, "not-a-uuid");

    expect(result).toEqual({ success: false, error: "Invalid id" });
    expect(deleteTripItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addTripPhotoAction", () => {
  it("adds the photo, logs, and revalidates the trip detail path", async () => {
    const row = { id: PHOTO_ID, url: "https://example.com/p.jpg" } as unknown as Awaited<
      ReturnType<typeof addTripPhoto>
    >;
    vi.mocked(addTripPhoto).mockResolvedValueOnce(row);

    const result = await addTripPhotoAction(TRIP_ID, {
      url: "https://example.com/p.jpg",
      source: "url",
    } as unknown as Parameters<typeof addTripPhotoAction>[1]);

    expect(result).toEqual({ success: true, data: row });
    expect(addTripPhoto).toHaveBeenCalledOnce();
    expect(addTripPhoto).toHaveBeenCalledWith(
      USER_ID,
      TRIP_ID,
      expect.objectContaining({ url: "https://example.com/p.jpg" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripPhoto.create",
        entityTable: "trip_photos",
        entityId: PHOTO_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});

describe("deleteTripPhotoAction", () => {
  it("deletes a url-source photo without touching storage", async () => {
    vi.mocked(deleteTripPhoto).mockResolvedValueOnce({
      source: "url",
      storagePath: null,
    } as unknown as Awaited<ReturnType<typeof deleteTripPhoto>>);

    const result = await deleteTripPhotoAction(TRIP_ID, PHOTO_ID);

    expect(result).toEqual({ success: true });
    expect(deleteTripPhoto).toHaveBeenCalledOnce();
    expect(deleteTripPhoto).toHaveBeenCalledWith(USER_ID, TRIP_ID, PHOTO_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripPhoto.delete",
        entityTable: "trip_photos",
        entityId: PHOTO_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});

describe("createTripShareAction", () => {
  it("creates the share and logs with inviteeEmail metadata", async () => {
    const row = { id: SHARE_ID } as unknown as Awaited<
      ReturnType<typeof createTripShare>
    >;
    vi.mocked(createTripShare).mockResolvedValueOnce(row);

    const result = await createTripShareAction(TRIP_ID, {
      inviteeEmail: "guest@example.com",
    } as unknown as Parameters<typeof createTripShareAction>[1]);

    expect(result).toEqual({ success: true, data: row });
    expect(createTripShare).toHaveBeenCalledOnce();
    expect(createTripShare).toHaveBeenCalledWith(
      USER_ID,
      TRIP_ID,
      expect.objectContaining({ inviteeEmail: "guest@example.com" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripShare.create",
        entityTable: "trip_shares",
        entityId: SHARE_ID,
        metadata: { inviteeEmail: "guest@example.com" },
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});

describe("revokeTripShareAction", () => {
  it("revokes the share on valid uuids", async () => {
    vi.mocked(revokeTripShare).mockResolvedValueOnce(undefined as never);

    const result = await revokeTripShareAction(TRIP_ID, SHARE_ID);

    expect(result).toEqual({ success: true });
    expect(revokeTripShare).toHaveBeenCalledOnce();
    expect(revokeTripShare).toHaveBeenCalledWith(USER_ID, TRIP_ID, SHARE_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripShare.revoke",
        entityTable: "trip_shares",
        entityId: SHARE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});

describe("deleteTripShareAction", () => {
  it("deletes the share on valid uuids", async () => {
    vi.mocked(deleteTripShare).mockResolvedValueOnce(undefined as never);

    const result = await deleteTripShareAction(TRIP_ID, SHARE_ID);

    expect(result).toEqual({ success: true });
    expect(deleteTripShare).toHaveBeenCalledOnce();
    expect(deleteTripShare).toHaveBeenCalledWith(USER_ID, TRIP_ID, SHARE_ID);
    expect(logImpersonatedMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tripShare.delete",
        entityTable: "trip_shares",
        entityId: SHARE_ID,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(tripPath(TRIP_ID));
  });
});
