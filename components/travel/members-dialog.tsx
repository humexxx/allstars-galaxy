"use client";

import { useState, useTransition } from "react";
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
import { Text } from "@/components/ui/typography";
import { setTripMembersAction } from "@/app/actions/travel";

export type MemberDraft = {
  id?: string;
  name: string;
  email: string;
  sharePercent: string;
};

/**
 * Who is going.
 *
 * A share left blank means "an equal cut of whatever the fixed shares leave
 * over", which is what most trips want and what nobody should have to type.
 * Email is optional and goes nowhere yet — it is here so the list is complete
 * when sending does arrive.
 */
export function MembersDialog({
  tripId,
  members,
  onClose,
}: {
  tripId: string;
  members: MemberDraft[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<MemberDraft[]>(
    members.length > 0 ? members : [{ name: "", email: "", sharePercent: "" }]
  );

  const update = (i: number, patch: Partial<MemberDraft>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const filled = rows.filter((r) => r.name.trim());
    startTransition(async () => {
      const res = await setTripMembersAction(tripId, {
        members: filled.map((r) => ({
          id: r.id,
          name: r.name.trim(),
          email: r.email.trim() || null,
          sharePercent: r.sharePercent.trim() === "" ? null : Number(r.sharePercent),
        })),
      });
      if (res.success) {
        toast.success("Travellers saved");
        router.refresh();
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  };

  const fixedTotal = rows.reduce(
    (sum, r) => sum + (r.sharePercent.trim() === "" ? 0 : Number(r.sharePercent) || 0),
    0
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Travellers</DialogTitle>
          <DialogDescription>
            Who is going. Leave a share blank to split the rest equally.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 ">
          <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_1fr_5rem_2rem]">
            {/* Column headings, not field labels: a Label with no control
                to point at announces as a label for nothing. */}
            <Text variant="small" weight="medium">Name</Text>
            <Text variant="small" weight="medium">Email (optional)</Text>
            <Text variant="small" weight="medium">Share %</Text>
            <span />
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_2rem]">
              <Input
                aria-label={`Name of traveller ${i + 1}`}
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Yalena"
              />
              <Input
                aria-label={`Email of traveller ${i + 1}`}
                type="email"
                value={row.email}
                onChange={(e) => update(i, { email: e.target.value })}
                placeholder="optional"
              />
              <Input
                aria-label={`Share for traveller ${i + 1}`}
                inputMode="decimal"
                value={row.sharePercent}
                onChange={(e) => update(i, { sharePercent: e.target.value })}
                placeholder="—"
                className="text-right tabular-nums"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 text-destructive"
                aria-label={`Remove traveller ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                setRows((prev) => [...prev, { name: "", email: "", sharePercent: "" }])
              }
            >
              <Plus className="size-4" /> Add traveller
            </Button>
            {fixedTotal > 0 && (
              <Text
                className={`text-2xs ${
                  fixedTotal > 100 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                Fixed shares total {fixedTotal.toFixed(0)}%
                {fixedTotal > 100 && " — that is more than the whole trip"}
              </Text>
            )}
          </div>

          <Text className="text-2xs text-muted-foreground">
            Removing somebody also removes them as a payer on any activity they
            were covering.
          </Text>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isPending || fixedTotal > 100}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
