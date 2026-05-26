import { Badge } from "@/components/ui/badge";
import type { TransactionStatus, TransactionType } from "@/types/portfolio";

export function StatusBadge({ status }: { status: TransactionStatus }) {
  switch (status) {
    case "approved":
      return <Badge variant="default" className="bg-green-500">Approved</Badge>;
    case "pending":
      return (
        <Badge variant="outline" className="border-yellow-500 bg-yellow-500/10 text-yellow-500">
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
