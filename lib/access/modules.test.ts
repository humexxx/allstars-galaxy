import { describe, expect, it } from "vitest";

import { PORTAL_NAV, visibleSections } from "@/components/portal/nav-config";

import { APP_MODULES, moduleOfPath, parseDisabledModules } from "./modules";

describe("app modules", () => {
  it("covers every product page in the nav, and nothing else", () => {
    const productUrls = PORTAL_NAV.filter((s) => s.label && !s.adminOnly && !s.disabled).flatMap((s) =>
      s.items.map((i) => i.url)
    );
    expect(APP_MODULES.map((m) => m.url).sort()).toEqual(productUrls.sort());
  });

  it("finds a page's module from any address under it", () => {
    expect(moduleOfPath("/portal/plans/abc?view=table")).toBe("plans");
    expect(moduleOfPath("/portal/entertainment/sports/f1/3")).toBe("sports");
    expect(moduleOfPath("/portal/trading")).toBe("trading");
    expect(moduleOfPath("/portal")).toBeNull();
    expect(moduleOfPath("/portal/plansx")).toBeNull();
  });

  it("drops stored names that are no longer modules", () => {
    expect(parseDisabledModules(["trading", "wellness", "sports"])).toEqual(["trading", "sports"]);
    expect(parseDisabledModules(null)).toEqual([]);
  });

  it("keeps a turned-off module in the nav, greyed out", () => {
    const finance = visibleSections("user", false, ["trading"]).find((s) => s.label === "Finance")!;
    expect(finance.items.find((i) => i.url === "/portal/trading")).toMatchObject({ disabled: true, locked: true });
    expect(finance.items.find((i) => i.url === "/portal/plans")?.disabled).toBeUndefined();
  });
});
