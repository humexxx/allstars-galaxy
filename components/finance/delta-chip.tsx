import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
}: {
  delta: number;
  since: { month: string; label: string };
  goodWhen?: "up" | "down";
}): React.ReactElement {
  const sign = moneySign(delta);
  const good = goodWhen === "up" ? sign > 0 : sign < 0;
  return (
    <Badge
      variant={sign === 0 ? "secondary" : good ? "success" : "destructive"}
      className="font-mono tabular-nums"
      title={`Against the close of ${since.label}`}
    >
      {sign > 0 ? <TrendingUp /> : sign < 0 ? <TrendingDown /> : null}
      {sign === 0 ? formatCurrency(0) : formatSignedCurrency(delta)} · vs {since.month}
    </Badge>
  );
}
