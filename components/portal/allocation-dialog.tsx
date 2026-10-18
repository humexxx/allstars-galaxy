"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { createPriceAssetAction, setAllocationsAction } from "@/app/actions/allocations";
import { runAction } from "@/lib/actions/run";
import { allocationTotal, isCompleteAllocation } from "@/lib/finance/allocation";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils/format";
import type { AssetOption } from "@/types/portfolio";

/** `key` is the row's identity: an index key moved focus and input state onto
 *  the next row whenever one above it was removed. */
type Row = { key: string; assetId: string; percent: string };

const newRow = (assetId: string, percent: string): Row => ({
  key: crypto.randomUUID(),
  assetId,
  percent,
});

type AllocationDialogProps = {
  open: boolean;
  methodId: string;
  methodName: string;
  assets: AssetOption[];
  initial: { assetId: string; percent: number }[];
  onClose: () => void;
};

const NEW_ASSET = "__new__";

export function AllocationDialog({
  open,
  methodId,
  methodName,
  assets,
  initial,
  onClose,
}: AllocationDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map((a) => newRow(a.assetId, String(a.percent)))
      : [newRow("", "100")]
  );

  const [creating, setCreating] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newTicker, setNewTicker] = useState("");

  const parsed = useMemo(
    () =>
      rows
        .filter((r) => r.assetId && r.assetId !== NEW_ASSET)
        .map((r) => ({ assetId: r.assetId, percent: Number(r.percent) || 0 })),
    [rows]
  );
  const total = allocationTotal(parsed);
  const complete = isCompleteAllocation(parsed);
  const symbolOf = (assetId: string): string | undefined =>
    assets.find((a) => a.id === assetId)?.symbol;

  const update = (key: string, patch: Partial<Row>): void =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = (): void => {
    startTransition(async () => {
      const result = await runAction(
        setAllocationsAction({ methodId, allocations: parsed }),
        { success: "Allocation saved", failure: "Failed to save allocation" }
      );
      if (result.ok) onClose();
    });
  };

  const addAsset = (): void => {
    startTransition(async () => {
      const result = await runAction(
        createPriceAssetAction({
          symbol: newSymbol,
          name: newName,
          source: "massive",
          externalId: newTicker,
        }),
        { failure: "Failed to create asset" }
      );
      if (!result.ok || !result.data) return;
      const { id } = result.data;
      setRows((prev) => [...prev, newRow(id, "0")]);
      setCreating(false);
      setNewSymbol("");
      setNewName("");
      setNewTicker("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocation — {methodName}</DialogTitle>
          <DialogDescription>
            How incoming money is split. This only affects contributions from now on —
            what past ones bought is already priced and stays put.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Column captions for sighted users; every control carries its own
              name, since only the first row sat under a real label. */}
          <div aria-hidden className="flex gap-2">
            <Text as="span" weight="medium" className="min-w-0 flex-1">
              Asset
            </Text>
            <Text as="span" weight="medium" className="w-24">
              Share %
            </Text>
            <span className="w-8 shrink-0" />
          </div>
          {rows.map((row, i) => {
            const label = symbolOf(row.assetId) ?? `row ${i + 1}`;
            return (
              <div key={row.key} className="flex items-center gap-2">
                <Select
                  value={row.assetId}
                  onValueChange={(v) =>
                    v === NEW_ASSET ? setCreating(true) : update(row.key, { assetId: v })
                  }
                >
                  <SelectTrigger aria-label={`Asset, row ${i + 1}`} className="min-w-0 flex-1">
                    <SelectValue placeholder="Pick an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.symbol} — {a.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_ASSET}>+ New asset…</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-label={`Share % for ${label}`}
                  className="w-24"
                  value={row.percent}
                  onChange={(e) => update(row.key, { percent: e.target.value })}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  aria-label={`Remove ${label}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => [...prev, newRow("", "0")])}
            >
              <Plus />
              Add asset
            </Button>
            <Text
              variant="small"
              role="status"
              aria-live="polite"
              className={cn(!complete && "text-destructive")}
            >
              Total <Mono>{formatPercent(total)}</Mono>
              {!complete && " — must be 100%"}
            </Text>
          </div>

          {creating && (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
              <Text variant="small">
                New asset, priced by Massive. The ticker is the provider&apos;s id —
                <Mono className="text-2xs"> X:ADAUSD</Mono> for crypto,
                <Mono className="text-2xs"> SPY</Mono> for a stock or ETF.
              </Text>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  placeholder="Symbol"
                  aria-label="Symbol"
                />
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  aria-label="Name"
                />
                <Input
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  placeholder="Ticker"
                  aria-label="Provider ticker"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isPending || !newSymbol || !newName || !newTicker}
                  onClick={addAsset}
                >
                  {isPending && <Spinner />}
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !complete}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
