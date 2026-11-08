import type { Metadata } from "next";

import { TradingJournalView } from "@/components/finance/trading/trading-journal-view";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getTradingJournal } from "@/lib/services/trading-journal-service";
import { getRequestTimeZone } from "@/lib/utils/request-today";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Trading journal" };

export default async function TradingJournalPage(): Promise<React.ReactElement> {
  const ctx = await requireEffectiveContext();
  const journal = await getTradingJournal(ctx.effectiveUserId, await getRequestTimeZone());
  return <TradingJournalView journal={journal} />;
}
