import { TableCell, TableHead } from "@/components/ui/table";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

/** Standard sports table header cell: the uppercase muted micro-label used by
 *  every standings/results table in the sports views. */
export function SportsTh({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <TableHead
      className={cn(
        "text-xs uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

/** Centered tabular-numeric cell for stats columns. */
export function TableCellNum({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <TableCell className={cn("text-center", className)}>
      <Mono className="text-sm tabular-nums">{value}</Mono>
    </TableCell>
  );
}
