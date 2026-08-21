import { describe, expect, it } from "vitest";

import { CATEGORIES, categoryMeta } from "./category";
import { tripItemCategoryEnum } from "@/db/schema";

describe("category identity", () => {
  it("covers every category the database allows", () => {
    // A category with no entry falls back to "Other", so it would render as
    // the wrong icon rather than as an obvious gap.
    expect(CATEGORIES.map((c) => c.value).sort()).toEqual(
      [...tripItemCategoryEnum.enumValues].sort()
    );
  });

  it("gives each category its own tint", () => {
    // Two categories sharing a colour is worse than none having one: it
    // asserts a relationship between them that does not exist.
    const tints = CATEGORIES.map((c) => c.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });

  it("keeps a readable foreground in both themes", () => {
    // The wash is 10% so it stays a hint; the text has to carry the contrast,
    // and a dark surface needs a lighter step than a light one.
    for (const c of CATEGORIES) {
      expect(c.tint).toMatch(/\btext-/);
      expect(c.tint === "bg-muted text-muted-foreground" || /dark:text-/.test(c.tint)).toBe(true);
    }
  });
});

describe("categoryMeta", () => {
  it("falls back to Other rather than returning nothing", () => {
    // A category that outruns this list must still render as something, and
    // the neutral one is the honest stand-in.
    expect(categoryMeta("nonsense" as never).value).toBe("other");
  });
});
