import { describe, expect, it } from "vitest";

import { f1RoundSchema } from "./f1";

describe("f1RoundSchema", () => {
  it("reads a round as its number", () => {
    expect(f1RoundSchema.parse("1")).toBe(1);
    expect(f1RoundSchema.parse("40")).toBe(40);
  });

  it("gives each race one address: no other spelling of its number", () => {
    for (const spelling of ["1.0", "03", "0x3", "1e1", " 3", "+3"]) {
      expect(f1RoundSchema.safeParse(spelling).success, spelling).toBe(false);
    }
  });

  it("is nothing that could not be a round", () => {
    for (const value of ["0", "100", "-1", "", "abc"]) {
      expect(f1RoundSchema.safeParse(value).success, value).toBe(false);
    }
  });
});
