import { describe, expect, it } from "vitest";

import { defaultShares, splitTrip } from "./split";
import type { SplitItem, SplitMember } from "./split";

const ana: SplitMember = { id: "ana", name: "Ana", sharePercent: null };
const bea: SplitMember = { id: "bea", name: "Bea", sharePercent: null };
const cid: SplitMember = { id: "cid", name: "Cid", sharePercent: null };

const item = (over: Partial<SplitItem> = {}): SplitItem => ({
  id: "i1",
  title: "Something",
  price: "100.00",
  priceMax: null,
  priceUnit: "total",
  scheduledOn: null,
  endsOn: null,
  payerIds: [],
  ...over,
});

describe("defaultShares", () => {
  it("splits equally when nobody has a fixed share", () => {
    const shares = defaultShares([ana, bea]);
    expect(shares.get("ana")).toBeCloseTo(0.5);
    expect(shares.get("bea")).toBeCloseTo(0.5);
  });

  it("honours a fixed share and divides the rest", () => {
    // Ana takes 60%; Bea and Cid split the remaining 40%.
    const shares = defaultShares([{ ...ana, sharePercent: 60 }, bea, cid]);
    expect(shares.get("ana")).toBeCloseTo(0.6);
    expect(shares.get("bea")).toBeCloseTo(0.2);
    expect(shares.get("cid")).toBeCloseTo(0.2);
  });

  it("never hands out a negative share when the fixed ones exceed 100", () => {
    // A typo must not turn into a rebate for everybody else.
    const shares = defaultShares([{ ...ana, sharePercent: 120 }, bea]);
    expect(shares.get("bea")).toBe(0);
  });

  it("returns nothing for a trip with nobody on it", () => {
    expect(defaultShares([]).size).toBe(0);
  });
});

describe("splitTrip", () => {
  it("divides an unassigned cost by the trip's split", () => {
    const [a, b] = splitTrip([item({ price: "300.00" })], [ana, bea]);
    expect(a.owed).toBe(150);
    expect(b.owed).toBe(150);
  });

  it("charges a named payer the whole thing", () => {
    // This is the case a plain "total ÷ people" gets wrong.
    const [a, b] = splitTrip(
      [item({ price: "300.00", payerIds: ["ana"] })],
      [ana, bea]
    );
    expect(a.owed).toBe(300);
    expect(b.owed).toBe(0);
  });

  it("splits between the named payers only", () => {
    const [a, b, c] = splitTrip(
      [item({ price: "300.00", payerIds: ["ana", "bea"] })],
      [ana, bea, cid]
    );
    expect(a.owed).toBe(150);
    expect(b.owed).toBe(150);
    expect(c.owed).toBe(0);
  });

  it("charges a per-person price in full to each person", () => {
    // A $1,900 fare is $1,900 each, not $1,900 shared.
    const [a, b] = splitTrip(
      [item({ price: "1900.00", priceUnit: "per_person" })],
      [ana, bea]
    );
    expect(a.owed).toBe(1900);
    expect(b.owed).toBe(1900);
  });

  it("charges a per-person price only to the payers named on it", () => {
    const [a, b] = splitTrip(
      [item({ price: "1900.00", priceUnit: "per_person", payerIds: ["ana"] })],
      [ana, bea]
    );
    expect(a.owed).toBe(1900);
    expect(b.owed).toBe(0);
  });

  it("multiplies a nightly rate before splitting it", () => {
    const [a, b] = splitTrip(
      [
        item({
          price: "100.00", priceUnit: "per_night",
          scheduledOn: "2027-01-15", endsOn: "2027-01-17",
        }),
      ],
      [ana, bea]
    );
    // 100 x 2 nights = 200, halved.
    expect(a.owed).toBe(100);
    expect(b.owed).toBe(100);
  });

  it("explains each figure line by line", () => {
    const [a] = splitTrip(
      [item({ id: "flight", title: "SJO ⇄ MCO", price: "600.00", payerIds: ["ana"] })],
      [ana, bea]
    );
    expect(a.lines).toEqual([{ itemId: "flight", title: "SJO ⇄ MCO", amount: 600 }]);
  });

  it("skips unpriced items rather than counting them as free", () => {
    const [a] = splitTrip([item({ price: null })], [ana]);
    expect(a.owed).toBe(0);
    expect(a.lines).toEqual([]);
  });

  it("handles the real Orlando trip for two people", () => {
    const orlando: SplitItem[] = [
      { ...item(), id: "f", title: "Flight", price: "600.00", priceUnit: "per_person" },
      {
        ...item(), id: "h", title: "Hotel", price: "100.00", priceUnit: "per_night",
        scheduledOn: "2027-01-15", endsOn: "2027-01-17",
      },
      { ...item(), id: "c", title: "Cruise", price: "1900.00", priceUnit: "per_person" },
    ];
    const [a, b] = splitTrip(orlando, [ana, bea]);
    // Each: 600 flight + 100 hotel (200 halved) + 1900 cruise.
    expect(a.owed).toBe(2600);
    expect(b.owed).toBe(2600);
  });
});
