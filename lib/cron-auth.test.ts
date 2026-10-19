import { afterEach, describe, expect, it } from "vitest";

import { isCronAuthorized } from "./cron-auth";

const ORIGINAL = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("isCronAuthorized", () => {
  it("accepts the exact bearer token", () => {
    process.env.CRON_SECRET = "s3cret-value-0123456789";
    expect(isCronAuthorized("Bearer s3cret-value-0123456789")).toBe(true);
  });

  it("rejects a wrong token of the same length and a missing header", () => {
    process.env.CRON_SECRET = "s3cret-value-0123456789";
    expect(isCronAuthorized("Bearer s3cret-value-0123456780")).toBe(false);
    expect(isCronAuthorized(null)).toBe(false);
  });

  it("answers false, not a throw, for a non-ASCII header of the same character length", () => {
    process.env.CRON_SECRET = "s3cret-value-0123456789";
    // "é" is one character but two UTF-8 bytes.
    expect(() => isCronAuthorized("Bearer s3cret-value-012345678é")).not.toThrow();
    expect(isCronAuthorized("Bearer s3cret-value-012345678é")).toBe(false);
  });

  it("fails closed when the secret is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized("Bearer anything")).toBe(false);
  });
});
