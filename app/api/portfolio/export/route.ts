import { NextResponse } from "next/server";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getUserPortfolio,
  getPortfolioTransactions,
  getInvestorTransactions,
} from "@/lib/services/portfolio-service";
import { getAllocationsByTransaction } from "@/lib/services/allocation-service";
import { getLatestPrices, listPriceAssets } from "@/lib/services/price-service";
import { listAllInvestmentMethods } from "@/lib/services/investment-method-service";

import { cell, signed } from "./csv";

/**
 * CSV of the transaction history, as rich as the screen it mirrors.
 *
 * Built server-side rather than from client state so the rows come from an
 * auth-gated query — `requireEffectiveContext` also means an admin who is
 * impersonating exports the impersonated user's history, matching what they
 * see.
 *
 * For someone who runs methods, the file also carries their investors' rows
 * and what every contribution actually bought. Exporting only the cash while
 * the app derives positions from it would hand back a file that cannot answer
 * the questions the app answers.
 */

/**
 * One definition drives the header, every row and the totals line.
 *
 * They used to be three hand-written lists that had to be kept the same
 * length. They drifted — a column was dropped from two of them and the totals
 * row silently shifted one place right, putting each sum under the wrong
 * heading. Deriving all three from this makes that impossible.
 */
type Row = {
  /** Which transaction the row belongs to: a split contribution emits
   *  several rows, and the totals line counts transactions, not rows. */
  txId: string;
  investor: string;
  date: string;
  type: string;
  status: string;
  method: string;
  risk: string;
  amount: string | null;
  fee: string | null;
  total: string | null;
  contributed: string | null;
  owed: string | null;
  asset: string;
  units: string;
  priceAtPurchase: string;
  worthNow: string;
  profitLoss: string;
  notes: string | null;
  /** Approved rows are the only ones the totals line counts. */
  approved: boolean;
};

const COLUMNS: {
  header: string;
  get: (r: Row) => unknown;
  sum?: boolean;
  /** What a contribution bought. The owner's private half of a method: only
   *  exported for methods the viewer runs, and the columns are dropped
   *  entirely for someone who runs none. */
  position?: boolean;
}[] = [
  { header: "Investor", get: (r) => r.investor },
  { header: "Date", get: (r) => r.date },
  { header: "Type", get: (r) => r.type },
  { header: "Status", get: (r) => r.status },
  { header: "Method", get: (r) => r.method },
  { header: "Risk", get: (r) => r.risk },
  { header: "Amount", get: (r) => r.amount, sum: true },
  { header: "Fee", get: (r) => r.fee, sum: true },
  { header: "Total", get: (r) => r.total, sum: true },
  { header: "Contributed", get: (r) => r.contributed, sum: true },
  // "Balance now", not "Owed now": on your own rows nobody owes you anything —
  // it is the promised balance, which is what an investor is owed.
  { header: "Balance now", get: (r) => r.owed, sum: true },
  { header: "Asset", get: (r) => r.asset, position: true },
  { header: "Units", get: (r) => r.units, position: true },
  { header: "Price at purchase", get: (r) => r.priceAtPurchase, position: true },
  { header: "Worth now", get: (r) => r.worthNow, sum: true, position: true },
  { header: "P/L", get: (r) => r.profitLoss, sum: true, position: true },
  { header: "Notes", get: (r) => r.notes },
];

export async function GET(): Promise<NextResponse> {
  const ctx = await requireEffectiveContext();

  const [portfolio, investorTxDesc, assets, methods] = await Promise.all([
    getUserPortfolio(ctx.effectiveUserId),
    getInvestorTransactions(ctx.effectiveUserId),
    listPriceAssets(),
    listAllInvestmentMethods(),
  ]);
  // Oldest first, like the viewer's own rows — the two blocks used to run in
  // opposite directions within one file.
  const investorTx = [...investorTxDesc].reverse();
  const owned = new Set(
    methods.filter((m) => m.ownerUserId === ctx.effectiveUserId).map((m) => m.id)
  );

  const own = portfolio ? await getPortfolioTransactions(portfolio.id) : [];
  if (own.length === 0 && investorTx.length === 0) {
    return NextResponse.json({ error: "Nothing to export yet" }, { status: 404 });
  }

  const [allocations, prices] = await Promise.all([
    // Positions only for methods this user runs: where a client's money is
    // deployed is never theirs to see, on screen or in a file.
    getAllocationsByTransaction([
      ...own.filter((t) => owned.has(t.investmentMethod.id)).map((t) => t.id),
      ...investorTx.map((t) => t.id),
    ]),
    getLatestPrices(assets.map((a) => a.id)),
  ]);
  const priceBySymbol = new Map(
    assets.map((a) => [a.symbol, prices.get(a.id) ?? null])
  );

  /** A contribution can be split across assets, so it can produce several rows. */
  const expand = (
    base: Omit<Row, "asset" | "units" | "priceAtPurchase" | "worthNow" | "profitLoss">,
    txId: string
  ): Row[] => {
    const parts = allocations.get(txId) ?? [];
    if (parts.length === 0) {
      return [{ ...base, asset: "", units: "", priceAtPurchase: "", worthNow: "", profitLoss: "" }];
    }
    return parts.map((p) => {
      const price = priceBySymbol.get(p.symbol) ?? null;
      const worth = price === null ? null : p.quantity * price;
      return {
        ...base,
        asset: p.symbol,
        units: p.quantity.toFixed(8),
        priceAtPurchase: p.priceAtPurchase.toFixed(8),
        worthNow: worth === null ? "" : worth.toFixed(2),
        profitLoss: worth === null ? "" : (worth - p.invested).toFixed(2),
        // Only the first split carries the cash figures, or a two-asset
        // contribution would double its own amount in the totals line.
        ...(parts.indexOf(p) === 0
          ? {}
          : { amount: null, fee: null, total: null, contributed: null, owed: null }),
      };
    });
  };

  const rows: Row[] = [
    ...own.flatMap((t) =>
      expand(
        {
          txId: t.id,
          investor: "You",
          date: t.date.toISOString().slice(0, 10),
          type: t.type,
          status: t.status,
          method: t.investmentMethod.name,
          risk: t.investmentMethod.riskLevel,
          // Signed like the investor rows below: the totals line added
          // your own withdrawals to your buys instead of netting them.
          amount: signed(t.amount, t.type),
          fee: t.fee,
          total: signed(t.total, t.type),
          contributed: t.initialValue,
          owed: t.currentValue,
          notes: t.notes,
          approved: t.status === "approved",
        },
        t.id
      )
    ),
    ...investorTx.flatMap((t) =>
      expand(
        {
          txId: t.id,
          investor: t.investorName,
          date: t.date.toISOString().slice(0, 10),
          type: t.type,
          status: t.status,
          method: t.methodName,
          risk: "",
          // Filled like your own rows: left blank, the Amount total covered
          // only your rows while Total covered everyone's.
          amount: signed(t.amount, t.type),
          fee: t.fee,
          // Signed so the totals line nets withdrawals instead of adding them.
          total: signed(t.total, t.type),
          contributed: t.initialValue,
          owed: t.currentValue,
          notes: null,
          approved: t.status === "approved",
        },
        t.id
      )
    ),
  ];

  const columns =
    owned.size > 0 || investorTx.length > 0 ? COLUMNS : COLUMNS.filter((c) => !c.position);
  const approved = rows.filter((r) => r.approved);
  // Transactions, not rows: a contribution split across two assets is one
  // movement, and counting its rows overstated the number.
  const txCount = (list: Row[]): number => new Set(list.map((r) => r.txId)).size;
  const totals = columns.map((c, i) => {
    if (i === 0) return `TOTAL (${txCount(approved)} approved of ${txCount(rows)})`;
    if (!c.sum) return "";
    return approved
      .reduce((acc, r) => acc + (Number(c.get(r)) || 0), 0)
      .toFixed(2);
  });

  const body = [
    columns.map((c) => c.header).join(","),
    ...rows.map((r) => columns.map((c) => cell(c.get(r))).join(",")),
    "",
    totals.map(cell).join(","),
  ];

  // BOM so Excel opens UTF-8 correctly instead of mangling accented names.
  const csv = "﻿" + body.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="portfolio-transactions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
