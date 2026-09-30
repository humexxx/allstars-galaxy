import { Badge } from "@/components/ui/badge";
import type { TransactionStatus, TransactionType } from "@/types/transaction";

export function StatusBadge({ status }: { status: TransactionStatus }) {
  switch (status) {
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
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
