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

  it("carries its colour as a theme token, not a raw hue", () => {
    // One token per category resolves to a light or a dark value in the
    // stylesheet, so no component carries a `dark:` override and a hue can be
    // retuned in one place.
    for (const c of CATEGORIES) {
      expect(c.tint).not.toMatch(/dark:/);
      expect(c.tint).toMatch(/^bg-(trip-[a-z]+\/10|muted) text-(trip-[a-z]+|muted-foreground)$/);
      expect(c.dot).toMatch(/^bg-(trip-[a-z]+|muted-foreground)$/);
    }
  });

  it("names the same token in the chip, the dot and the bar", () => {
    // Three sizes of the same category. Drifting apart would make a phone and
    // a desktop disagree about what colour a cruise is.
    for (const c of CATEGORIES) {
      const token = c.dot.replace("bg-", "");
      expect(c.tint).toContain(`text-${token}`);
      expect(c.bar).toContain(`text-${token}`);
    }
  });

  it("keeps the calendar bar solid on a phone and soft on a pointer", () => {
    // A bar a few pixels tall with no room for a label has only its colour to
    // carry the meaning; one that does carry a label needs to sit behind it,
    // with the edge doing the work a darker fill would cost in contrast.
    for (const c of CATEGORIES) {
      expect(c.bar).toMatch(/^bg-\S+ text-\S+ sm:bg-\S+ sm:ring-1 sm:ring-\S+$/);
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
