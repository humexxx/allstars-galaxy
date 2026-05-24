"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import {
  createTripShareAction,
  deleteTripShareAction,
  revokeTripShareAction,
} from "@/app/actions/travel";
import type { TripShare, TripWithRelations } from "@/types/travel";

type TripSharePanelProps = {
  trip: TripWithRelations;
  baseUrl: string;
};

function shareUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/trips/${token}`;
}

export function TripSharePanel({ trip, baseUrl }: TripSharePanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [creating, startCreate] = useTransition();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email or leave it blank");
      return;
    }
    startCreate(async () => {
      const res = await createTripShareAction(trip.id, {
        inviteeEmail: trimmed || null,
      });
      if (res.success && res.data) {
        const url = shareUrl(baseUrl, res.data.token);
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Share link copied to clipboard");
        } catch {
          toast.success("Share link created");
        }
        setEmail("");
        router.refresh();
      } else if (!res.success) {
        toast.error(res.error);
      }
    });
  };

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(baseUrl, token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const active = trip.shares.filter((s) => s.revokedAt === null);
  const revoked = trip.shares.filter((s) => s.revokedAt !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="space-y-2">
          <Label htmlFor="share-email" className="text-xs">
            Generate a private link
          </Label>
          <div className="flex gap-2">
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com (optional)"
              disabled={creating}
            />
            <Button type="submit" disabled={creating}>
              {creating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-1 h-4 w-4" />
              )}
              Create link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The email is just a label — we don&apos;t send a message. Copy the link and share it
            on WhatsApp, X, Slack or Instagram and the preview card will appear automatically.
          </p>
        </form>

        {active.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Active links</p>
            <ul className="space-y-2">
              {active.map((share) => (
                <ShareRow
                  key={share.id}
                  tripId={trip.id}
                  share={share}
                  baseUrl={baseUrl}
                  copied={copiedToken === share.token}
                  onCopy={() => handleCopy(share.token)}
                />
              ))}
            </ul>
          </div>
        )}

        {revoked.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Revoked ({revoked.length})</summary>
            <ul className="mt-2 space-y-1">
              {revoked.map((share) => (
                <li key={share.id} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1">
                  <span>
                    {share.inviteeEmail ?? "Anonymous"} ·{" "}
                    {share.revokedAt ? format(new Date(share.revokedAt), "MMM d") : ""}
                  </span>
                  <DeleteRevokedButton tripId={trip.id} shareId={share.id} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function ShareRow({
  tripId,
  share,
  baseUrl,
  copied,
  onCopy,
}: {
  tripId: string;
  share: TripShare;
  baseUrl: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const url = shareUrl(baseUrl, share.token);

  const handleRevoke = () => {
    startTransition(async () => {
      const res = await revokeTripShareAction(tripId, share.id);
      if (res.success) {
        toast.success("Link revoked");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <li className="space-y-1 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">
          {share.inviteeEmail ?? "Anyone with the link"}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-6 w-6 text-destructive hover:text-destructive")}
          onClick={handleRevoke}
          disabled={busy}
          aria-label="Revoke link"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Mono className="flex-1 truncate rounded border bg-background px-2 py-1 text-[11px]">
          {url}
        </Mono>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7"
          onClick={onCopy}
          aria-label="Copy link"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </li>
  );
}

function DeleteRevokedButton({ tripId, shareId }: { tripId: string; shareId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-5 w-5"
      onClick={() =>
        startTransition(async () => {
          const res = await deleteTripShareAction(tripId, shareId);
          if (res.success) {
            router.refresh();
          } else {
            toast.error(res.error);
          }
        })
      }
      disabled={busy}
      aria-label="Delete record"
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  );
}
