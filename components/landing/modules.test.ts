import { describe, expect, it } from "vitest";

import { PORTAL_NAV } from "@/components/portal/nav-config";

import { LIVE_MODULES, SOON_MODULES, countWord } from "./modules";

// The portal nav is the product as it ships; the landing is what we say about
// it. Admin pages and the dashboard are not modules a visitor signs up for.
const productSections = PORTAL_NAV.filter((section) => section.label && !section.adminOnly);

const byHref = (a: { href: string }, b: { href: string }): number => a.href.localeCompare(b.href);

describe("landing modules", () => {
  it("names every page in the portal nav, under the nav's own section and name", () => {
    const navPages = productSections
      .filter((section) => !section.disabled)
      .flatMap((section) =>
        section.items.map((item) => ({ area: section.label, name: item.title, href: item.url }))
      );
    const landingPages = LIVE_MODULES.map(({ area, name, href }) => ({ area, name, href }));

    expect(landingPages.sort(byHref)).toEqual(navPages.sort(byHref));
  });

  it("lists the nav's coming-soon sections as coming soon", () => {
    const soonSections = productSections
      .filter((section) => section.disabled)
      .map((section) => section.label);

    expect(SOON_MODULES.map((module) => module.area)).toEqual(soonSections);
  });

  it("spells small counts out and falls back to digits", () => {
    expect(countWord(6)).toBe("six");
    expect(countWord(1)).toBe("one");
    expect(countWord(42)).toBe("42");
  });
});
