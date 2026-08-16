"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mono, Text } from "@/components/ui/typography";
import { createPriceAssetAction, setAllocationsAction } from "@/app/actions/allocations";
import { allocationTotal, isCompleteAllocation } from "@/lib/finance/allocation";

export type AssetOption = {
  id: string;
  symbol: string;
  name: string;
  source: string;
};

type Row = { assetId: string; percent: string };

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<Row[]>(
    initial.length > 0
      ? initial.map((a) => ({ assetId: a.assetId, percent: String(a.percent) }))
      : [{ assetId: "", percent: "100" }]
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

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    startTransition(async () => {
      const result = await setAllocationsAction({ methodId, allocations: parsed });
      if (result?.success) {
        toast.success("Allocation saved");
        router.refresh();
        onClose();
      } else {
        toast.error(result?.error ?? "Could not save the allocation");
      }
    });
  };

  const addAsset = () => {
    startTransition(async () => {
      const created = await createPriceAssetAction({
        symbol: newSymbol,
        name: newName,
        source: "massive",
        externalId: newTicker,
      });
      if (!created?.success || !created.data) {
        toast.error(created?.success ? "Could not create the asset" : created?.error ?? "Failed");
        return;
      }
      setRows((prev) => [...prev, { assetId: created.data!.id, percent: "0" }]);
      setCreating(false);
      setNewSymbol("");
      setNewName("");
      setNewTicker("");
      router.refresh();
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

        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                {i === 0 && <Label>Asset</Label>}
                <Select
                  value={row.assetId}
                  onValueChange={(v) =>
                    v === NEW_ASSET ? setCreating(true) : update(i, { assetId: v })
                  }
                >
                  <SelectTrigger>
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
              </div>
              <div className="w-24 space-y-2">
                {i === 0 && <Label htmlFor={`pct-${i}`}>Share %</Label>}
                <Input
                  id={`pct-${i}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={row.percent}
                  onChange={(e) => update(i, { percent: e.target.value })}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-9 shrink-0 text-destructive"
                aria-label="Remove row"
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { assetId: "", percent: "0" }])}
            >
              <Plus className="size-4" />
              Add asset
            </Button>
            <Text
              className={`text-xs ${complete ? "text-muted-foreground" : "text-destructive"}`}
            >
              Total <Mono className="tabular-nums">{total.toFixed(2)}%</Mono>
              {!complete && " — must be 100%"}
            </Text>
          </div>

          {creating && (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <Text className="text-xs text-muted-foreground">
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
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isPending || !newSymbol || !newName || !newTicker}
                  onClick={addAsset}
                >
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
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
