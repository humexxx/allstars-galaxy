"use client";

import { useState, useSyncExternalStore } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { KeyExpiryWarning } from "@/lib/ai/key-expiry";
import { formatDay } from "@/lib/utils/date";

const SEEN_KEY = "ai-key-expiry-seen";

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function seenStage(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Reminds admins, on any portal page, that the Claude API key is running out.
 *
 * Each warning stage (a month, twenty days, ten, then one per day) shows once
 * per browser; "Later" remembers the stage, so the next one still comes. On
 * the server it renders closed, and opens once the browser has checked what
 * it already showed.
 */
export function AiKeyExpiryNotice({
  warning,
  expiresOn,
}: {
  warning: KeyExpiryWarning;
  expiresOn: string;
}) {
  const seen = useSyncExternalStore(subscribe, seenStage, () => warning.stage);
  const [closed, setClosed] = useState(false);

  const dismiss = (): void => {
    try {
      window.localStorage.setItem(SEEN_KEY, warning.stage);
    } catch {
      // Private mode: it simply asks again next time.
    }
    setClosed(true);
  };

  const { daysLeft } = warning;
  const title =
    daysLeft < 0
      ? "The Claude API key has expired"
      : daysLeft === 0
        ? "The Claude API key expires today"
        : `The Claude API key expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  return (
    <AlertDialog open={!closed && seen !== warning.stage} onOpenChange={(open) => !open && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {daysLeft < 0
              ? `It stopped working on ${formatDay(expiresOn)}, and the travel assistant with it.`
              : `On ${formatDay(expiresOn)} the travel assistant stops answering.`}{" "}
            Create a new key in Claude Console, put it in ANTHROPIC_API_KEY on Vercel and in your
            .env, then set its date in Settings → AI.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={dismiss}>Later</AlertDialogCancel>
          <AlertDialogAction asChild onClick={dismiss}>
            <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">
              Create a new key
            </a>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
