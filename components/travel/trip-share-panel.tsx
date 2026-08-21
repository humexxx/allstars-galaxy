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
import { Mono, Text } from "@/components/ui/typography";
import { Badge } from "@/components/ui/badge";

import {
  createTripShareAction,
  deleteTripShareAction,
  revokeTripShareAction,
} from "@/app/actions/travel";
import type { TripShare, TripWithRelations } from "@/types/travel";

type TripSharePanelProps = {
  trip: TripWithRelations;
  baseUrl: string;
  /** Traveller in focus upstairs. A link created now carries their view. */
  scopeToMemberId?: string | null;
  scopeName?: string | null;
};

function shareUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/trips/${token}`;
}

export function TripSharePanel({
  trip,
  baseUrl,
  scopeToMemberId = null,
  scopeName = null,
}: TripSharePanelProps) {
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
        memberId: scopeToMemberId,
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

  // Expired links are rejected by the public resolver exactly like revoked
  // ones — listing them as "Active" hands the owner a copyable dead link.
  // Snapshot "now" once per mount: render-pure, and expiry granularity is
  // days, so a stale-by-minutes comparison is irrelevant.
  const [now] = useState(() => Date.now());
  const isExpired = (s: TripShare): boolean =>
    s.expiresAt !== null && new Date(s.expiresAt).getTime() < now;
  const active = trip.shares.filter((s) => s.revokedAt === null && !isExpired(s));
  const revoked = trip.shares.filter((s) => s.revokedAt !== null || isExpired(s));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 ">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 ">
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
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Link2 className="mr-1 size-4" />
              )}
              {scopeName ? `Link for ${scopeName.split(" ")[0]}` : "Create link"}
            </Button>
          </div>
          {/* Said before the click, not after: which traveller a link exposes
              is not something to discover from the result. */}
          <Text variant="small">
            {scopeToMemberId && scopeName ? (
              <>
                This link will show{" "}
                <span className="font-medium text-foreground">{scopeName}&apos;s</span>{" "}
                share of each cost — not the trip totals, and not the other
                travellers. Pick <span className="font-medium text-foreground">All</span>{" "}
                above the cover photo for a link to the whole trip.
              </>
            ) : (
              <>
                This link will show the plan without any prices. Pick a traveller above
                the cover photo first to send somebody their own share instead.
              </>
            )}
          </Text>
          <Text variant="small">
            The email is just a label — we don&apos;t send a message. Copy the link and share it
            on WhatsApp, X, Slack or Instagram and the preview card will appear automatically.
          </Text>
        </form>

        {active.length > 0 && (
          <div className="flex flex-col gap-2 ">
            <Text variant="small" weight="medium">Active links</Text>
            <ul className="flex flex-col gap-2 ">
              {active.map((share) => (
                <ShareRow
                  key={share.id}
                  tripId={trip.id}
                  share={share}
                  baseUrl={baseUrl}
                  copied={copiedToken === share.token}
                  memberName={
                    trip.members.find((m) => m.id === share.memberId)?.name ?? null
                  }
                  onCopy={() => handleCopy(share.token)}
                />
              ))}
            </ul>
          </div>
        )}

        {revoked.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">
              Revoked or expired ({revoked.length})
            </summary>
            <ul className="flex flex-col gap-1 mt-2">
              {revoked.map((share) => (
                <li key={share.id} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1">
                  <Text as="span" variant="small">
                    {share.inviteeEmail ?? "Anonymous"} ·{" "}
                    {share.revokedAt ? (
                      <Mono>{format(new Date(share.revokedAt), "MMM d")}</Mono>
                    ) : share.expiresAt ? (
                      <Mono>expired {format(new Date(share.expiresAt), "MMM d")}</Mono>
                    ) : (
                      ""
                    )}
                  </Text>
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
  memberName,
  onCopy,
}: {
  tripId: string;
  share: TripShare;
  baseUrl: string;
  copied: boolean;
  /** Traveller this link is scoped to, or null for the whole trip. */
  memberName: string | null;
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
    <li className="flex flex-col gap-1 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">
            {share.inviteeEmail ?? "Anyone with the link"}
          </span>
          {/* Two links to the same trip can show completely different money.
              Which is which cannot live only in the owner's memory. */}
          <Badge variant="outline" className="shrink-0 text-2xs font-normal">
            {memberName ?? "Whole trip"}
          </Badge>
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 text-destructive hover:text-destructive sm:size-7"
          onClick={handleRevoke}
          disabled={busy}
          aria-label="Revoke link"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Mono className="flex-1 truncate rounded border bg-background px-2 py-1 text-2xs">
          {url}
        </Mono>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-9 sm:size-7"
          onClick={onCopy}
          aria-label="Copy link"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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
      className="size-8 sm:size-6"
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
      <Trash2 className="size-3.5" />
    </Button>
  );
}
