import { Card } from "@/components/ui/card";
import { TableCell, TableHead } from "@/components/ui/table";
import { Eyebrow, Mono } from "@/components/ui/typography";
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

/**
 * A table that sits flush in a card.
 *
 * `<Card><CardContent className="px-0">` kept the card's own vertical padding,
 * which printed an empty band above the header row and under the last row of
 * every standings table. The table's header row is the top edge here; a title,
 * when there is one, gets its own bar above it.
 */
export function TableCard({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      {title && (
        <div className="border-b px-4 py-3">
          <Eyebrow as="div">{title}</Eyebrow>
        </div>
      )}
      {children}
    </Card>
  );
}
