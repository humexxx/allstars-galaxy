import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/transaction-service", () => ({
  createTransaction: vi.fn(),
}));

vi.mock("@/lib/services/snapshot-service", () => ({
  createApprovalSnapshot: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { createApprovalSnapshot } from "@/lib/services/snapshot-service";
import { createTransaction } from "@/lib/services/transaction-service";

import { createTransactionAction } from "./transactions";

// NOTE: zod v4's `z.string().uuid()` enforces variant + version bits, so test
// fixtures must be valid v4 UUIDs (version nibble = 4, variant nibble in 8-b).
const USER_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_USER_ID = "11111111-1111-4111-8111-111111111111";
const INVESTMENT_METHOD_ID = "22222222-2222-4222-8222-222222222222";
const PORTFOLIO_ID = "33333333-3333-4333-8333-333333333333";
const TRANSACTION_ID = "44444444-4444-4444-8444-444444444444";

function userCtx(userId = USER_ID) {
  return {
    realUser: { id: userId } as never,
    realRole: "user" as const,
    impersonatedUser: null,
    effectiveUserId: userId,
    isImpersonating: false,
  };
}

function adminCtx(adminId = ADMIN_ID) {
  return {
    realUser: { id: adminId } as never,
    realRole: "admin" as const,
    impersonatedUser: null,
    effectiveUserId: adminId,
    isImpersonating: false,
  };
}

function pendingTxn() {
  return {
    id: TRANSACTION_ID,
    portfolioId: PORTFOLIO_ID,
    status: "pending",
  } as unknown as Awaited<ReturnType<typeof createTransaction>>["transaction"];
}

function approvedTxn() {
  return {
    id: TRANSACTION_ID,
    portfolioId: PORTFOLIO_ID,
    status: "approved",
  } as unknown as Awaited<ReturnType<typeof createTransaction>>["transaction"];
}

function portfolio() {
  return { id: PORTFOLIO_ID } as unknown as Awaited<
    ReturnType<typeof createTransaction>
  >["portfolio"];
}

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue(userCtx());
  vi.mocked(createTransaction).mockResolvedValue({
    transaction: pendingTxn(),
    portfolio: portfolio(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createTransactionAction", () => {
  it("creates a pending transaction for a regular user (happy path)", async () => {
    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "100.50",
      date: new Date(),
      notes: "first buy",
    } as never);

    expect(result).toEqual({ success: true, data: pendingTxn() });

    expect(createTransaction).toHaveBeenCalledTimes(1);
    const [targetId, callerId, payload] = vi.mocked(createTransaction).mock
      .calls[0];
    expect(targetId).toBe(USER_ID);
    expect(callerId).toBe(USER_ID);
    expect(payload).toMatchObject({
      investmentMethodId: INVESTMENT_METHOD_ID,
      type: "buy",
      amount: "100.50",
      notes: "first buy",
    });
    expect(payload.date).toBeInstanceOf(Date);

    expect(logImpersonatedMutation).toHaveBeenCalledWith({
      action: "transaction.create",
      entityTable: "transactions",
      entityId: TRANSACTION_ID,
    });

    expect(revalidatePath).toHaveBeenCalledWith("/portal/portfolio");
    expect(revalidatePath).toHaveBeenCalledWith("/portal/admin/transactions");
    expect(revalidatePath).toHaveBeenCalledTimes(2);

    // pending transaction => no approval snapshot
    expect(createApprovalSnapshot).not.toHaveBeenCalled();
  });

  it("clamps a user's date to 'now' when within the 1-day drift window", async () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 60); // 1h ago
    await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: recentDate,
    } as never);

    expect(createTransaction).toHaveBeenCalledTimes(1);
    const [, , payload] = vi.mocked(createTransaction).mock.calls[0];
    // Date is clamped to ~ Date.now()
    const drift = Math.abs((payload.date as Date).getTime() - Date.now());
    expect(drift).toBeLessThan(5_000);
  });

  it("rejects out-of-window dates for regular users without calling the service", async () => {
    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    } as never);

    expect(result).toEqual({
      success: false,
      error:
        "Regular users can only create transactions with the current date",
    });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an Invalid input envelope on malformed payloads", async () => {
    const result = await createTransactionAction({
      investmentMethodId: "not-a-uuid",
      amount: "10",
      date: new Date(),
    } as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns an Invalid input envelope when amount fails zod regex", async () => {
    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "abc",
      date: new Date(),
    } as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("forbids regular users from creating transactions on behalf of others", async () => {
    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: new Date(),
      userId: OTHER_USER_ID,
    } as never);

    expect(result).toEqual({
      success: false,
      error: "Only admins can create transactions for other users",
    });
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("lets admins create transactions for other users and back-date them", async () => {
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce(adminCtx());
    const backDated = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30d ago

    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "500",
      date: backDated,
      userId: OTHER_USER_ID,
    } as never);

    expect(result).toEqual({ success: true, data: pendingTxn() });

    const [targetId, callerId, payload] = vi.mocked(createTransaction).mock
      .calls[0];
    expect(targetId).toBe(OTHER_USER_ID);
    expect(callerId).toBe(ADMIN_ID);
    // admin: date is NOT clamped
    expect((payload.date as Date).getTime()).toBe(backDated.getTime());
  });

  it("creates an approval snapshot when an admin's transaction is auto-approved", async () => {
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce(adminCtx());
    vi.mocked(createTransaction).mockResolvedValueOnce({
      transaction: approvedTxn(),
      portfolio: portfolio(),
    });

    const txDate = new Date();
    await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "1000",
      date: txDate,
    } as never);

    expect(createApprovalSnapshot).toHaveBeenCalledTimes(1);
    const [pfId, snapshotDate] = vi.mocked(createApprovalSnapshot).mock
      .calls[0];
    expect(pfId).toBe(PORTFOLIO_ID);
    expect(snapshotDate).toBeInstanceOf(Date);
  });

  it("does NOT create an approval snapshot when an impersonating admin posts", async () => {
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce({
      realUser: { id: ADMIN_ID } as never,
      realRole: "admin",
      impersonatedUser: {
        id: OTHER_USER_ID,
        email: "imp@example.com",
        fullName: "Imp",
      },
      effectiveUserId: OTHER_USER_ID,
      isImpersonating: true,
    });
    vi.mocked(createTransaction).mockResolvedValueOnce({
      transaction: approvedTxn(),
      portfolio: portfolio(),
    });

    await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: new Date(),
    } as never);

    // isAdmin = false (because isImpersonating=true), so snapshot is skipped
    expect(createApprovalSnapshot).not.toHaveBeenCalled();

    // Caller id passed to the service is the impersonated user id
    const [targetId, callerId] = vi.mocked(createTransaction).mock.calls[0];
    expect(targetId).toBe(OTHER_USER_ID);
    expect(callerId).toBe(OTHER_USER_ID);
  });

  it("swallows requireEffectiveContext failures into the safe() envelope", async () => {
    vi.mocked(requireEffectiveContext).mockRejectedValueOnce(
      new Error("Unauthorized"),
    );

    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: new Date(),
    } as never);

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(createTransaction).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("swallows service-layer failures into the safe() envelope", async () => {
    vi.mocked(createTransaction).mockRejectedValueOnce(new Error("pg boom"));

    const result = await createTransactionAction({
      investmentMethodId: INVESTMENT_METHOD_ID,
      amount: "10",
      date: new Date(),
    } as never);

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
  });
});
