import { itemCost, type PricedItem } from "./pricing";

export type SplitMember = {
  id: string;
  name: string;
  /** Share of anything not assigned to specific payers, 0–100. Null = take an
   *  equal share of whatever the explicit shares leave over. */
  sharePercent: number | null;
};

export type SplitItem = PricedItem & {
  id: string;
  title: string;
  /** Members covering THIS item. Empty means "however the trip splits". */
  payerIds: string[];
};

export type MemberShare = {
  memberId: string;
  name: string;
  /** What this person owes across the whole trip. */
  owed: number;
  /** Per item, so the figure can be explained rather than asserted. */
  lines: { itemId: string; title: string; amount: number }[];
};

/**
 * How the trip splits when an item names no payers.
 *
 * Members with an explicit percentage take it; the rest divide what is left
 * equally. That way "Ana pays 60%" needs one number rather than everybody
 * restating theirs, and the shares always total 100 even when nobody has set
 * any.
 */
export function defaultShares(members: SplitMember[]): Map<string, number> {
  const shares = new Map<string, number>();
  if (members.length === 0) return shares;

  const fixed = members.filter((m) => m.sharePercent !== null);
  const rest = members.filter((m) => m.sharePercent === null);
  const claimed = fixed.reduce((sum, m) => sum + (m.sharePercent ?? 0), 0);

  for (const m of fixed) shares.set(m.id, (m.sharePercent ?? 0) / 100);

  if (rest.length > 0) {
    // Never negative: if the fixed shares already exceed 100 the remainder is
    // zero, not a rebate for everybody else.
    const remainder = Math.max(0, 100 - claimed) / 100;
    const each = remainder / rest.length;
    for (const m of rest) shares.set(m.id, each);
  }

  return shares;
}

/**
 * What each member owes, item by item.
 *
 * An item's own payers win over the trip's split — that is the whole point of
 * naming them. Dividing the total by the number of travellers instead would be
 * wrong the moment one person covers the flights and another the hotel, which
 * is the normal case rather than the exception.
 *
 * `perPerson` prices are NOT divided: a $1,900 fare is $1,900 for each person
 * it applies to, so it is charged to each payer in full.
 */
export function splitTrip(items: SplitItem[], members: SplitMember[]): MemberShare[] {
  const shares = defaultShares(members);
  const byMember = new Map<string, MemberShare>(
    members.map((m) => [m.id, { memberId: m.id, name: m.name, owed: 0, lines: [] }])
  );

  const partySize = Math.max(1, members.length);

  for (const item of items) {
    if (item.price === null) continue;
    const cost = itemCost(item, partySize);
    if (cost.low === 0) continue;

    const payers = item.payerIds.filter((id) => byMember.has(id));

    if (item.priceUnit === "per_person") {
      // A per-person price is already one person's cost. Whoever it applies to
      // owes the whole unit price, not a slice of the multiplied total.
      const each = cost.unitLow ?? 0;
      const targets = payers.length > 0 ? payers : members.map((m) => m.id);
      for (const id of targets) {
        const share = byMember.get(id);
        if (!share) continue;
        share.owed += each;
        share.lines.push({ itemId: item.id, title: item.title, amount: each });
      }
      continue;
    }

    if (payers.length > 0) {
      // Named payers divide it equally between themselves — a per-payer
      // percentage is a refinement nobody has asked for yet.
      const each = cost.low / payers.length;
      for (const id of payers) {
        const share = byMember.get(id)!;
        share.owed += each;
        share.lines.push({ itemId: item.id, title: item.title, amount: each });
      }
      continue;
    }

    for (const m of members) {
      const amount = cost.low * (shares.get(m.id) ?? 0);
      if (amount === 0) continue;
      const share = byMember.get(m.id)!;
      share.owed += amount;
      share.lines.push({ itemId: item.id, title: item.title, amount });
    }
  }

  return members.map((m) => byMember.get(m.id)!);
}
