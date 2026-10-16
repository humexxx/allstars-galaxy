import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeNextPath("/portal/plans?view=table#top")).toBe("/portal/plans?view=table#top");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab before the second slash", "/\t/evil.com"],
    ["newline", "/\n/evil.com"],
    ["absolute URL", "https://evil.com"],
    ["userinfo trick", "@evil.com"],
    ["empty", ""],
  ])("refuses a %s redirect", (_label, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
