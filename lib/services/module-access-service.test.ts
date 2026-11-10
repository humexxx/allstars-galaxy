import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/services/module-access-service");

const rows: { disabledModules: string[] }[] = [];
const updates: { disabledModules: SQL }[] = [];
const matched: { id: string }[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => rows }) }),
    update: () => ({
      set: (v: { disabledModules: SQL }) => ({
        where: () => ({
          returning: async () => {
            updates.push(v);
            return matched;
          },
        }),
      }),
    }),
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
  matched.length = 0;
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

  it("adds and removes a module in the statement itself, so the list is never read first", async () => {
    matched.push({ id: "u3" });
    await expect(setModuleEnabled("u3", "trading", false)).resolves.toBe(true);
    await expect(setModuleEnabled("u3", "sports", true)).resolves.toBe(true);

    const written = updates.map((u) => new PgDialect().sqlToQuery(u.disabledModules));
    expect(written).toMatchObject([
      {
        sql: 'array_append(array_remove("users"."disabled_modules", $1::text), $2::text)',
        params: ["trading", "trading"],
      },
      { sql: 'array_remove("users"."disabled_modules", $1::text)', params: ["sports"] },
    ]);
  });

  it("says when there is no such account", async () => {
    await expect(setModuleEnabled("missing", "trading", false)).resolves.toBe(false);
  });
});
