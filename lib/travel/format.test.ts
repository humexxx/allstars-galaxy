import { describe, expect, it } from "vitest";

import { moneyRange } from "./format";

describe("moneyRange", () => {
  it("collapses to one figure when the ends agree", () => {
    expect(moneyRange(3800, 3800, "USD")).toBe("$3,800");
  });

  it("shows both ends when they do not", () => {
    expect(moneyRange(600, 800, "USD")).toBe("$600 – $800");
  });
});


describe("where moneyRange lives", () => {
  it("is importable from a server component", async () => {
    // It used to be exported from `traveller-bar.tsx`, a client module. The
    // public trip page is a server component, so the moment a shared link was
    // allowed to show prices the page crashed with "Attempted to call
    // moneyRange() from the server". A pure formatter must not carry a
    // runtime boundary — so this module must not open with the directive.
    const { readFileSync } = await import("node:fs");
    const first = readFileSync("lib/travel/format.ts", "utf8")
      .split("\n")
      .find((l) => l.trim() !== "");
    expect(first).not.toMatch(/^["']use client["']/);
  });
});
