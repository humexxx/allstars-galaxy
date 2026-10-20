import { afterEach, describe, expect, it, vi } from "vitest";

const selects: unknown[][] = [];
const calls = { insert: [] as unknown[], conflict: [] as unknown[] };

function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of ["from", "where", "groupBy", "orderBy"]) c[m] = vi.fn(() => c);
  c.values = vi.fn((v: unknown) => {
    calls.insert.push(v);
    return c;
  });
  c.onConflictDoUpdate = vi.fn((v: unknown) => {
    calls.conflict.push(v);
    return c;
  });
  c.then = (ok: (r: unknown[]) => unknown) => Promise.resolve(rows).then(ok);
  return c;
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => chain(selects.shift() ?? [])),
    insert: vi.fn(() => chain([])),
  },
}));

import { getAiSettings, getAiUsageSummary, recordAiUsage, updateAiSettings } from "./ai-service";

afterEach(() => {
  selects.length = 0;
  calls.insert.length = 0;
  calls.conflict.length = 0;
});

describe("getAiSettings", () => {
  it("is the defaults until somebody saves", async () => {
    selects.push([]);
    expect(await getAiSettings()).toEqual({ model: "claude-opus-5-5", apiKeyExpiresOn: null });
  });

  it("falls back to the default when the saved model is no longer offered", async () => {
    selects.push([{ model: "claude-retired", apiKeyExpiresOn: "2027-10-19" }]);
    expect(await getAiSettings()).toEqual({ model: "claude-opus-5-5", apiKeyExpiresOn: "2027-10-19" });
  });
});

describe("updateAiSettings", () => {
  it("creates the one row or updates it, and says who did", async () => {
    selects.push([{ model: "claude-sonnet-5-5", apiKeyExpiresOn: null }]);
    await updateAiSettings("admin-1", { model: "claude-sonnet-5-5" });
    expect(calls.insert[0]).toMatchObject({ id: 1, model: "claude-sonnet-5-5", updatedBy: "admin-1" });
    expect(calls.conflict[0]).toMatchObject({ set: { model: "claude-sonnet-5-5", updatedBy: "admin-1" } });
  });
});

describe("recordAiUsage", () => {
  it("stores the tokens and their cost at the model's prices", async () => {
    await recordAiUsage({
      userId: "admin-1",
      feature: "travel-assistant",
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: null },
    });
    expect(calls.insert[0]).toMatchObject({
      model: "claude-sonnet-5-5",
      inputTokens: 1000,
      cacheReadInputTokens: 0,
      // $2 in + $10 out per million.
      costUsd: "0.012000",
    });
  });
});

describe("getAiUsageSummary", () => {
  it("leads with this month even before anything is spent in it", async () => {
    selects.push([{ month: "2026-09", costUsd: "3.5", requests: 40 }], [{ costUsd: null, requests: 0 }]);
    const summary = await getAiUsageSummary("America/Costa_Rica", "2026-10-19");
    expect(summary).toEqual({
      today: { costUsd: 0, requests: 0 },
      months: [
        { month: "2026-10", costUsd: 0, requests: 0 },
        { month: "2026-09", costUsd: 3.5, requests: 40 },
      ],
    });
  });
});
