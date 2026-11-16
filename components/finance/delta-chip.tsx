import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { maskValue } from "@/components/ui/stat-card";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";

/**
 * How far a figure moved since a period closed: "+$1,204.10 · vs Nov",
 * green when it moved the good way. The dashboard card and the plans page
 * put it beside net worth.
 */
export function DeltaChip({
  delta,
  since,
  goodWhen = "up",
  hideValues = false,
}: {
  delta: number;
  since: { month: string; label: string };
  goodWhen?: "up" | "down";
  /** Masks the amount and keeps its direction, which gives no balance away. */
  hideValues?: boolean;
}): React.ReactElement {
  const sign = moneySign(delta);
  const amount = sign === 0 ? formatCurrency(0) : formatSignedCurrency(delta);
  const good = goodWhen === "up" ? sign > 0 : sign < 0;
  return (
    <Badge
      variant={sign === 0 ? "secondary" : good ? "success" : "destructive"}
      className="font-mono tabular-nums"
      title={`Against ${since.label}`}
    >
      {sign > 0 ? <TrendingUp /> : sign < 0 ? <TrendingDown /> : null}
      {hideValues ? `${sign > 0 ? "+" : sign < 0 ? "-" : ""}${maskValue(amount)}` : amount} · vs {since.month}
    </Badge>
  );
}
