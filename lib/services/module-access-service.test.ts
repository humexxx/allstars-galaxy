import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/services/module-access-service");

const rows: { disabledModules: string[] }[] = [];
const updates: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => rows }) }),
    update: () => ({ set: (v: unknown) => ({ where: async () => updates.push(v) }) }),
  },
}));

const requireEffectiveContext = vi.fn();
vi.mock("@/lib/services/impersonation", () => ({ requireEffectiveContext: () => requireEffectiveContext() }));

const redirect = vi.fn((to: string) => {
  throw new Error(`redirect ${to}`);
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

import {
  getDisabledModules,
  ModuleDisabledError,
  requireModuleContext,
  requireModulePage,
  setModuleEnabled,
} from "./module-access-service";

beforeEach(() => {
  rows.length = 0;
  updates.length = 0;
  requireEffectiveContext.mockResolvedValue({ effectiveUserId: "u1" });
});

describe("module access", () => {
  it("reads the account's turned-off modules, dropping unknown names", async () => {
    rows.push({ disabledModules: ["trading", "old-thing"] });
    await expect(getDisabledModules("u-read")).resolves.toEqual(["trading"]);
  });

  it("sends a page of a turned-off module to the dashboard, and lets others through", async () => {
    rows.push({ disabledModules: ["trading"] });
    await expect(requireModulePage("trading")).rejects.toThrow("redirect /portal");
    await expect(requireModulePage("plans")).resolves.toEqual({ effectiveUserId: "u1" });
  });

  it("refuses an action of a turned-off module", async () => {
    requireEffectiveContext.mockResolvedValue({ effectiveUserId: "u2" });
    rows.push({ disabledModules: ["board"] });
    await expect(requireModuleContext("board")).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it("adds and removes a module from the off list, once", async () => {
    rows.push({ disabledModules: ["sports"] });
    await setModuleEnabled("u3", "trading", false);
    await setModuleEnabled("u3", "sports", true);
    expect(updates).toEqual([
      expect.objectContaining({ disabledModules: ["sports", "trading"] }),
      expect.objectContaining({ disabledModules: [] }),
    ]);
  });

  it("says when there is no such account", async () => {
    await expect(setModuleEnabled("missing", "trading", false)).resolves.toBe(false);
  });
});
