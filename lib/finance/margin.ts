/**
 * The margin maths, kept pure and separate from any query.
 *
 * The model, in one line: investors are promised a fixed return, the admin
 * deploys the pooled capital somewhere else, and the margin is whatever the
 * real holdings are worth above what is owed.
 *
 *   liability = what investors are owed  (their compounded currentValue)
 *   assets    = what the deployed capital is really worth  (qty x price)
 *   margin    = assets - liability
 *
 * A negative margin is the number that matters most: it means the promised
 * return is outrunning the real one and the admin is covering the difference
 * out of pocket. It must never be hidden or clamped to zero.
 */

export type MarginHolding = {
  /** Row identity. The maths never reads these — the UI needs them to edit or
   *  remove a position, and a symbol is not a stable key across methods. */
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  quantity: number;
  /** Latest known price, or null when no quote has ever landed. */
  price: number | null;
  costBasis: number;
};

export type MethodMargin = {
  methodId: string;
  methodName: string;
  /** Owed to investors OTHER than the owner. */
  liability: number;
  /** The owner's own position in their own method, tracked apart: you do not
   *  owe yourself, so it is capital rather than liability. */
  ownPosition: number;
  /** Present value of the real holdings. */
  assets: number;
  /** assets - liability. Negative = paying the promise out of pocket. */
  margin: number;
  /** Margin as a share of what is owed. 0 when nothing is owed. */
  marginPercent: number;
  holdings: MarginHolding[];
  /** True when any holding has no price yet — `assets` is then understated
   *  and the UI must say so rather than present it as complete. */
  incomplete: boolean;
};

/**
 * Split a method's investors into what is owed and what is the owner's own.
 *
 * You cannot owe yourself a fixed return, so the owner's stake is capital, not
 * liability. Counting it as debt would understate the margin by exactly that
 * stake and make a healthy method look like it was losing money.
 */
export function splitLiability(
  investors: { userId: string; holding: number }[],
  ownerUserId: string
): { liability: number; ownPosition: number } {
  let liability = 0;
  let ownPosition = 0;
  for (const investor of investors) {
    if (investor.userId === ownerUserId) ownPosition += investor.holding;
    else liability += investor.holding;
  }
  return { liability, ownPosition };
}

export function computeMethodMargin(input: {
  methodId: string;
  methodName: string;
  liability: number;
  ownPosition: number;
  holdings: MarginHolding[];
}): MethodMargin {
  const assets = input.holdings.reduce(
    (sum, h) => sum + (h.price === null ? 0 : h.quantity * h.price),
    0
  );
  const margin = assets - input.liability;

  return {
    methodId: input.methodId,
    methodName: input.methodName,
    liability: input.liability,
    ownPosition: input.ownPosition,
    assets,
    margin,
    marginPercent: input.liability > 0 ? (margin / input.liability) * 100 : 0,
    holdings: input.holdings,
    incomplete: input.holdings.some((h) => h.price === null),
  };
}

/** Roll several methods into one headline. */
export function totalMargin(methods: MethodMargin[]): {
  liability: number;
  assets: number;
  margin: number;
  incomplete: boolean;
} {
  return {
    liability: methods.reduce((s, m) => s + m.liability, 0),
    assets: methods.reduce((s, m) => s + m.assets, 0),
    margin: methods.reduce((s, m) => s + m.margin, 0),
    incomplete: methods.some((m) => m.incomplete),
  };
}
