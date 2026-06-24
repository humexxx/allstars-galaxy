import { Badge } from "@/components/ui/badge";
import type { TransactionStatus, TransactionType } from "@/types/portfolio";

export function StatusBadge({ status }: { status: TransactionStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          Approved
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          Pending
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "closed":
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function TypeBadge({ type }: { type: TransactionType }) {
  return type === "buy" ? (
    <Badge variant="secondary">Buy</Badge>
  ) : (
    <Badge variant="outline">Withdrawal</Badge>
  );
}
