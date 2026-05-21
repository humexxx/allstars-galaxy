import { db } from "@/db";
import { investmentMethods } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import {
  getUserPortfolio,
  getPortfolioStats,
  getPortfolioTransactions,
} from "@/lib/services/portfolio-service";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { getAllUsers } from "@/lib/services/user-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import type { PortfolioTransaction } from "@/types/portfolio";
import PortfolioClientPage from "@/components/portal/portfolio-client";

export const metadata: Metadata = {
  title: "Portfolio | Capital Galaxy",
  description: "View and manage your investment portfolio",
};

export default async function PortfolioPage() {
  const ctx = await requireEffectiveContext();
  const isAdmin = ctx.realRole === "admin";

  // When impersonating, show the impersonated user's portfolio. Otherwise show the real user's.
  const userId = ctx.effectiveUserId;

  const usersPromise = isAdmin ? getAllUsers() : Promise.resolve([]);
  const [portfolio, methods, users] = await Promise.all([
    getUserPortfolio(userId),
    // Disabled methods are hidden from the portfolio (they only exist as
    // hypothetical scenarios for finance plans).
    db.select().from(investmentMethods).where(eq(investmentMethods.enabled, true)),
    usersPromise,
  ]);

  let stats = null;
  let transactions: PortfolioTransaction[] = [];
  let chartData: { date: string; value: number }[] = [];

  if (portfolio) {
    [stats, transactions, chartData] = await Promise.all([
      getPortfolioStats(portfolio.id),
      getPortfolioTransactions(portfolio.id),
      getPortfolioPerformanceData(portfolio.id, "All"),
    ]);

    // Fallback: build chart from approved transactions if no snapshots exist.
    if (chartData.length === 0) {
      const approvedTransactions = transactions.filter((t) => t.status === "approved");
      if (approvedTransactions.length > 0) {
        let runningTotal = 0;
        chartData = approvedTransactions.map((t) => {
          runningTotal += t.type === "buy" ? parseFloat(t.total) : -parseFloat(t.total);
          return { date: new Date(t.date).toISOString(), value: runningTotal };
        });
      }
    }
  }

  const data = {
    portfolio,
    stats,
    transactions,
    chartData,
    methods,
    isAdmin,
    users,
    currentUserId: userId,
  };

  return <PortfolioClientPage data={data} />;
}
