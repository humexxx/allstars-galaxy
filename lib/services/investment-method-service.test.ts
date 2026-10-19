import { getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `isAssetOnlyInOwnMethods` decides who may hand-type a shared price. Each
 * read is stubbed by the table it starts from: the policy (`method_allocations`)
 * and the units actually held (`transaction_allocations`).
 */

type OwnerRow = { ownerUserId: string | null };

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ASSET = "00000000-0000-4000-8000-0000000000a1";

let policyOwners: OwnerRow[] = [];
let holderOwners: OwnerRow[] = [];

function chain(table: PgTable): unknown {
  const rows = (): OwnerRow[] => {
    switch (getTableName(table)) {
      case "method_allocations":
        return policyOwners;
      case "transaction_allocations":
        return holderOwners;
      default:
        throw new Error(`unexpected table ${getTableName(table)}`);
    }
  };
  const self = {
    innerJoin: () => self,
    where: () => self,
    then: (resolve: (r: OwnerRow[]) => unknown) => Promise.resolve(rows()).then(resolve),
  };
  return self;
}

vi.mock("@/db", () => {
  const from = { from: (table: PgTable) => chain(table) };
  return { db: { select: () => from, selectDistinct: () => from } };
});

import { isAssetOnlyInOwnMethods } from "./investment-method-service";

afterEach(() => {
  policyOwners = [];
  holderOwners = [];
});

describe("isAssetOnlyInOwnMethods", () => {
  it("refuses when another owner still holds units the policy no longer lists", async () => {
    // B bought units of X, then dropped X from the policy. A's policy alone
    // lists X — but a quote from A would revalue B's units, and B's margin.
    policyOwners = [{ ownerUserId: A }];
    holderOwners = [{ ownerUserId: A }, { ownerUserId: B }];

    await expect(isAssetOnlyInOwnMethods(ASSET, A)).resolves.toBe(false);
  });

  it("allows the owner whose methods alone list and hold the asset", async () => {
    policyOwners = [{ ownerUserId: A }];
    holderOwners = [{ ownerUserId: A }];

    await expect(isAssetOnlyInOwnMethods(ASSET, A)).resolves.toBe(true);
  });

  it("refuses when another owner's policy lists the asset", async () => {
    policyOwners = [{ ownerUserId: A }, { ownerUserId: B }];

    await expect(isAssetOnlyInOwnMethods(ASSET, A)).resolves.toBe(false);
  });

  it("refuses when units sit in a method nobody owns", async () => {
    policyOwners = [{ ownerUserId: A }];
    holderOwners = [{ ownerUserId: null }];

    await expect(isAssetOnlyInOwnMethods(ASSET, A)).resolves.toBe(false);
  });

  it("refuses when no policy of the caller lists the asset", async () => {
    await expect(isAssetOnlyInOwnMethods(ASSET, A)).resolves.toBe(false);
  });
});
