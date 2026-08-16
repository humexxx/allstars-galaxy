import { NextResponse } from "next/server";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  getUserPortfolio,
  getPortfolioTransactions,
} from "@/lib/services/portfolio-service";

/**
 * CSV of the signed-in user's transaction history.
 *
 * Built server-side rather than from client state so the rows come from an
 * auth-gated query — `requireEffectiveContext` also means an admin who is
 * impersonating exports the impersonated user's history, matching what they
 * see on screen.
 */

/**
 * RFC 4180 quoting. The leading-symbol guard is the important part: a cell
 * starting with = + - or @ is executed as a formula by Excel and Sheets, so a
 * crafted note could run on whoever opens the file. Prefixing a single quote
 * neutralises it without changing the visible text.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const COLUMNS = [
  "Date",
  "Type",
  "Status",
  "Method",
  "Risk",
  "Amount",
  "Fee",
  "Total",
  "Initial value",
  "Current value",
  "Notes",
] as const;

export async function GET() {
  const ctx = await requireEffectiveContext();

  const portfolio = await getUserPortfolio(ctx.effectiveUserId);
  if (!portfolio) {
    return NextResponse.json({ error: "No portfolio yet" }, { status: 404 });
  }

  const transactions = await getPortfolioTransactions(portfolio.id);

  const rows = transactions.map((t) =>
    [
      t.date.toISOString().slice(0, 10),
      t.type,
      t.status,
      t.investmentMethod.name,
      t.investmentMethod.riskLevel,
      t.amount,
      t.fee,
      t.total,
      t.initialValue,
      t.currentValue,
      t.notes,
    ]
      .map(cell)
      .join(",")
  );

  // Totals row. Only the money columns are summed — averaging a status or a
  // risk level would be nonsense — and only APPROVED rows count, so a pending
  // or rejected transaction doesn't inflate the total the way it doesn't
  // inflate the portfolio on screen.
  const approved = transactions.filter((t) => t.status === "approved");
  const sum = (pick: (t: (typeof approved)[number]) => string | null) =>
    approved.reduce((acc, t) => acc + (Number(pick(t)) || 0), 0).toFixed(2);

  const totals = [
    `TOTAL (${approved.length} approved of ${transactions.length})`,
    "",
    "",
    "",
    "",
    "",
    sum((t) => t.amount),
    sum((t) => t.fee),
    sum((t) => t.total),
    sum((t) => t.initialValue),
    sum((t) => t.currentValue),
    "",
  ]
    .map(cell)
    .join(",");

  // BOM so Excel opens UTF-8 correctly instead of mangling accented names.
  const csv =
    "﻿" + [COLUMNS.join(","), ...rows, "", totals].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="portfolio-transactions-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
