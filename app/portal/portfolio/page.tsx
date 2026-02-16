import { db } from "@/db";
import { investmentMethods } from "@/db/schema";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio | Capital Galaxy",
  description: "View and manage your investment portfolio",
};
import {
  getUserPortfolio,
  getPortfolioStats,
  getPortfolioTransactions,
} from "@/lib/services/portfolio-service";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { requireAuthCached, getUserRoleCached } from "@/lib/services/auth-server";
import { getAllUsers } from "@/lib/services/user-service";
import type { PortfolioTransaction } from "@/types/portfolio";
import PortfolioClientPage from "@/components/portal/portfolio-client";

type PageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function PortfolioPage({ searchParams }: PageProps) {
  const [params, currentUser] = await Promise.all([
    searchParams,
    requireAuthCached(),
  ]);
  const role = await getUserRoleCached(currentUser.id);
  const isAdmin = role === "admin";

  // Determine which user's portfolio to show
  // Admin can view any user via userId param, defaults to their own
  // Regular users always see their own
  const userId = isAdmin && params.userId ? params.userId : currentUser.id;

  const usersPromise = isAdmin ? getAllUsers() : Promise.resolve([]);
  const [portfolio, methods, users] = await Promise.all([
    getUserPortfolio(userId),
    db.select().from(investmentMethods),
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
    
    // Fallback: Generate chart data from approved transactions if no snapshots exist
    if (chartData.length === 0) {
      const approvedTransactions = transactions.filter(
        (t) => t.status === "approved"
      );
      if (approvedTransactions.length > 0) {
        let runningTotal = 0;
        chartData = approvedTransactions.map((t) => {
          if (t.type === "buy") {
            runningTotal += parseFloat(t.total);
          } else {
            runningTotal -= parseFloat(t.total);
          }
          return {
            date: new Date(t.date).toISOString(),
            value: runningTotal,
          };
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
