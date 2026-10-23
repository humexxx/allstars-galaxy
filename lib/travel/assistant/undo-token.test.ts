import { afterEach, describe, expect, it } from "vitest";

import { readUndo, signUndo } from "./undo-token";

const ORIGINAL = process.env.CRON_SECRET;
const USER = "user-1";
const NOW = Date.parse("2026-10-19T12:00:00Z");

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("undo receipts", () => {
  it("reads back what it signed, for the user it was signed for", () => {
    process.env.CRON_SECRET = "a-test-secret-long-enough";
    const token = signUndo(USER, [{ kind: "delete_trip" }], NOW)!;
    expect(readUndo(token, USER, NOW)).toEqual([{ kind: "delete_trip" }]);
    expect(readUndo(token, "user-2", NOW)).toBeNull();
  });

  it("rejects an edited receipt", () => {
    process.env.CRON_SECRET = "a-test-secret-long-enough";
    const token = signUndo(USER, [{ kind: "delete_trip", tripId: "a" }], NOW)!;
    const [body, sig] = token.split(".");
    const edited = Buffer.from(
      Buffer.from(body, "base64url").toString().replace('"a"', '"b"')
    ).toString("base64url");
    expect(readUndo(`${edited}.${sig}`, USER, NOW)).toBeNull();
  });

  it("expires after a day", () => {
    process.env.CRON_SECRET = "a-test-secret-long-enough";
    const token = signUndo(USER, [], NOW)!;
    expect(readUndo(token, USER, NOW + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("is not offered without a secret to sign with", () => {
    delete process.env.CRON_SECRET;
    expect(signUndo(USER, [], NOW)).toBeNull();
  });
});
