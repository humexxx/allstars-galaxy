"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { applyTravelChangesAction, undoTravelChangesAction } from "@/app/actions/travel-assistant";
import { AssistantButton, ChatHeader, ChatWindow } from "@/components/assistant/chat-window";
import { Composer } from "@/components/assistant/composer";
import {
  AssistantBubble,
  AssistantError,
  AssistantStatus,
  Suggestions,
  UserBubble,
} from "@/components/assistant/messages";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { readEvents } from "@/lib/ai/assistant/stream";
import { uploadTripPhoto, type UploadedPhoto } from "@/lib/travel/photo-upload";
import type {
  TravelAssistantEvent,
  TravelAssistantMessage,
  TravelChangeLine,
  TravelProposal,
} from "@/types/travel-assistant";

type TravelAssistantContent = Exclude<TravelAssistantMessage["content"], string>[number];

import { TripPhoto } from "../trip-photo";
import { PendingProposalProvider, type PendingProposal } from "./pending-preview";
import { PendingReviewBar } from "./pending-review-bar";
import { ProposalCard, type ProposalState } from "./proposal-card";

type Entry =
  | { kind: "user"; id: string; text: string; images: string[] }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "error"; id: string; message: string }
  | {
      kind: "proposal";
      id: string;
      proposal: TravelProposal;
      state: ProposalState;
      applied?: TravelChangeLine[];
      undoToken?: string | null;
      error?: string;
    };

type ProposalEntry = Extract<Entry, { kind: "proposal" }>;

const SUGGESTIONS = [
  "Plan Orlando from Jan 16 to 24: flights SJO → MCO, a hotel near the parks and two days at Universal",
  "What do I still need to book on my next trip?",
  "Move everything on this trip one day later",
];

let nextId = 0;
const newId = (): string => `entry-${++nextId}`;

const TRAVEL = "/portal/entertainment/travel-planner";

/**
 * The travel assistant: a corner button on the Travel pages that opens a chat.
 *
 * The conversation lives here, in the layout, so it survives moving between
 * the trip list and a trip. It holds two things: what the user sees
 * (`entries`) and the conversation as the API keeps it (`transcript`), which
 * goes back to the server untouched on every message.
 *
 * Nothing the assistant proposes is written until the user presses Apply, and
 * what the user did with a card reaches the model as a note on their next
 * message — the model would otherwise go on assuming its changes were saved.
 *
 * It wraps the Travel pages so they can draw the open proposal on themselves:
 * when one arrives, the assistant opens the trip it touches and the page shows
 * the trip as it would be. On a wide screen the chat floats in a corner, so
 * the page stays in view beside it; a phone has room for one of the two, so
 * the chat makes way and a bar on the page applies or discards.
 */
export function TravelAssistant({ children }: { children?: ReactNode }) {
  const params = useParams<{ id?: string }>();
  const tripId = typeof params.id === "string" && params.id !== "new" ? params.id : null;
  const router = useRouter();
  const pathname = usePathname();
  const phone = useIsMobile();

  const [open, setOpen] = useState(false);
  /** The chat said something after it made way for a proposal. */
  const [unread, setUnread] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const transcript = useRef<TravelAssistantMessage[]>([]);
  const notes = useRef<string[]>([]);
  /** The page the model was last told about; undefined before the first message. */
  const toldTripId = useRef<string | null | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, status]);

  const update = (id: string, patch: Partial<ProposalEntry>): void =>
    setEntries((all) => all.map((e) => (e.id === id && e.kind === "proposal" ? { ...e, ...patch } : e)));

  const appendText = (assistantId: string, text: string): void =>
    setEntries((all) => {
      const at = all.findIndex((e) => e.id === assistantId);
      if (at === -1) return [...all, { kind: "assistant", id: assistantId, text }];
      const entry = all[at];
      if (entry.kind !== "assistant") return all;
      const next = [...all];
      next[at] = { ...entry, text: entry.text + text };
      return next;
    });

  async function attach(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadTripPhoto(file, "assistant");
        setAttachments((all) => [...all, uploaded]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function send(text: string): Promise<void> {
    const images = attachments;
    const message = text.trim() || (images.length ? "(See the attached images.)" : "");
    if (!message || busy || uploading) return;
    setDraft("");
    setAttachments([]);
    setBusy(true);
    setEntries((all) => [
      ...all,
      { kind: "user", id: newId(), text: message, images: images.map((i) => i.url) },
    ]);

    // Claude sees each picture, and the note gives it what it needs to save
    // one as a cover or a photo if asked.
    const imageNote = images.length
      ? `[Attached images: ${images.map((i, n) => `${n + 1}. url=${i.url} storagePath=${i.storagePath}`).join("; ")}]`
      : null;
    const content: TravelAssistantContent[] = [
      ...notes.current.map((t) => ({ type: "text" as const, text: t })),
      ...images.map((i) => ({ type: "image" as const, source: { type: "url" as const, url: i.url } })),
      ...(imageNote ? [{ type: "text" as const, text: imageNote }] : []),
      { type: "text" as const, text: message },
    ];
    notes.current = [];
    const history: TravelAssistantMessage[] = [...transcript.current, { role: "user", content }];
    transcript.current = history;
    const context = toldTripId.current === tripId ? undefined : { tripId };
    toldTripId.current = tripId;

    // A new assistant bubble after every card, so text never lands above one.
    let assistantId = newId();
    let proposed: TravelProposal | null = null;
    try {
      const response = await fetch("/api/travel/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The assistant did not answer");
      }
      await readEvents<TravelAssistantEvent>(response.body, (event) => {
        switch (event.type) {
          case "text":
            setStatus(null);
            appendText(assistantId, event.text);
            break;
          case "status":
            setStatus(event.label);
            break;
          case "proposal":
            setStatus(null);
            proposed = event.proposal;
            setEntries((all) => [
              // A newer proposal replaces one still waiting: the page shows one.
              ...all.map((e) =>
                e.kind === "proposal" && e.state === "open" ? { ...e, state: "cancelled" as const } : e
              ),
              { kind: "proposal", id: newId(), proposal: event.proposal, state: "open" },
            ]);
            assistantId = newId();
            break;
          case "navigate":
            if (event.href !== pathname) router.push(event.href);
            break;
          case "turn":
            transcript.current = [...history, ...event.messages];
            break;
          case "error":
            setEntries((all) => [...all, { kind: "error", id: newId(), message: event.message }]);
            break;
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant did not answer";
      setEntries((all) => [...all, { kind: "error", id: newId(), message }]);
    } finally {
      setStatus(null);
      setBusy(false);
    }
    if (proposed) showOnPage(proposed);
  }

  /** Opens the page the proposal changes; on a phone, the chat makes way for it. */
  function showOnPage(proposal: TravelProposal): void {
    const fresh = proposal.previews.find((p) => p.isNew);
    const first = proposal.previews[0];
    const target = fresh ? `${TRAVEL}/preview` : first ? `${TRAVEL}/${first.tripId}` : null;
    if (!target) return;
    if (target !== pathname) router.push(target);
    if (phone) {
      setOpen(false);
      setUnread(true);
    }
  }

  async function apply(entry: ProposalEntry): Promise<void> {
    update(entry.id, { state: "applying", error: undefined });
    const result = await applyTravelChangesAction(entry.proposal.set);
    if (!result.success) {
      update(entry.id, { state: "open", error: result.error });
      notes.current.push(`[Note: the user pressed Apply on "${entry.proposal.set.summary}" but it failed: ${result.error}. Nothing was saved.]`);
      return;
    }
    const { lines, undoToken } = result.data;
    update(entry.id, { state: "applied", applied: lines, undoToken });
    const createdTrips = lines.filter((l) => l.subject === "trip" && l.action === "add" && l.tripId);
    const created = createdTrips.map((l) => ` The new trip "${l.title}" has id ${l.tripId}.`).join("");
    notes.current.push(`[Note: the user applied "${entry.proposal.set.summary}"; it is saved.${created}]`);

    // The preview page was a stand-in; the trip has a page of its own now.
    // A trip that is gone leaves the user on the list.
    if (createdTrips[0]?.tripId) router.push(`${TRAVEL}/${createdTrips[0].tripId}`);
    else if (lines.some((l) => l.subject === "trip" && l.action === "remove" && pathname.endsWith(l.entityId ?? "-")))
      router.push(TRAVEL);
    toast.success("Changes applied", {
      action: undoToken
        ? { label: "Undo", onClick: () => void undo({ ...entry, state: "applied", applied: lines, undoToken }) }
        : undefined,
    });
  }

  function cancel(entry: ProposalEntry): void {
    update(entry.id, { state: "cancelled" });
    notes.current.push(`[Note: the user cancelled "${entry.proposal.set.summary}"; nothing was saved.]`);
    if (pathname === `${TRAVEL}/preview`) router.push(TRAVEL);
  }

  async function undo(entry: ProposalEntry): Promise<void> {
    if (!entry.undoToken) return;
    update(entry.id, { state: "undoing", error: undefined });
    const result = await undoTravelChangesAction(entry.undoToken);
    if (!result.success) {
      update(entry.id, { state: "applied", error: result.error });
      return;
    }
    update(entry.id, { state: "undone" });
    notes.current.push(`[Note: the user undid "${entry.proposal.set.summary}"; those changes are reverted.]`);
    // A trip the undo removed again has no page to stay on.
    const createdHere = entry.applied?.some(
      (l) => l.subject === "trip" && l.action === "add" && l.tripId && pathname.endsWith(l.tripId)
    );
    if (createdHere) router.push(TRAVEL);
    else router.refresh();
  }

  function reset(): void {
    setEntries([]);
    transcript.current = [];
    notes.current = [];
    toldTripId.current = undefined;
  }

  const waiting = entries.findLast(
    (e): e is ProposalEntry => e.kind === "proposal" && (e.state === "open" || e.state === "applying")
  );
  const pending: PendingProposal | null = waiting
    ? {
        id: waiting.id,
        summary: waiting.proposal.set.summary,
        previews: waiting.proposal.previews,
        count: waiting.proposal.lines.length,
        applying: waiting.state === "applying",
        apply: () => void apply(waiting),
        discard: () => cancel(waiting),
      }
    : null;

  // Only the newest receipt can be undone: undoing an older one would put
  // back fields a later change has since moved on from.
  const lastApplied = entries.findLast(
    (e): e is ProposalEntry => e.kind === "proposal" && (e.state === "applied" || e.state === "undoing")
  )?.id;

  const openChat = (): void => {
    setOpen(true);
    setUnread(false);
  };

  return (
    <PendingProposalProvider value={pending}>
      {children}
      {/* With the chat open, its card decides; the bar is for when it is not. */}
      {waiting && !open && <PendingReviewBar proposal={pending!} onOpenChat={openChat} unread={unread} />}
      {/* The review bar carries its own way back to the chat. */}
      <AssistantButton label="Open the travel assistant" onClick={openChat} hidden={open || Boolean(waiting)} />

      <ChatWindow open={open} onOpenChange={setOpen} phone={phone} slot="travel-assistant-window" focus={input}>
        <ChatHeader
          title="Travel assistant"
          description="Describe a trip or a change. Nothing is saved until you apply it."
          onReset={entries.length > 0 ? reset : undefined}
          busy={busy}
        />

        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {entries.length === 0 && <Suggestions items={SUGGESTIONS} onPick={setDraft} />}

          {entries.map((entry) => {
            switch (entry.kind) {
              case "user":
                return (
                  <UserBubble key={entry.id} text={entry.text}>
                    {entry.images.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {entry.images.map((url) => (
                          <span key={url} className="relative block size-16 overflow-hidden rounded-lg bg-muted">
                            <TripPhoto src={url} alt="Attached image" sizes="64px" />
                          </span>
                        ))}
                      </div>
                    )}
                  </UserBubble>
                );
              case "assistant":
                return <AssistantBubble key={entry.id} text={entry.text} />;
              case "error":
                return <AssistantError key={entry.id} message={entry.message} />;
              case "proposal":
                return (
                  <ProposalCard
                    key={entry.id}
                    proposal={entry.proposal}
                    state={entry.state}
                    applied={entry.applied}
                    error={entry.error}
                    canUndo={entry.id === lastApplied && Boolean(entry.undoToken)}
                    onApply={() => void apply(entry)}
                    onCancel={() => cancel(entry)}
                    onUndo={() => void undo(entry)}
                  />
                );
            }
          })}

          {busy && <AssistantStatus label={status} />}
        </div>

        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void send(draft)}
          busy={busy}
          canSend={!busy && !uploading && (Boolean(draft.trim()) || attachments.length > 0)}
          placeholder="Plan a trip, add a booking, change dates…"
          label="Message the travel assistant"
          inputRef={input}
          above={
            (attachments.length > 0 || uploading) && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span key={a.storagePath} className="relative block size-14 overflow-hidden rounded-lg bg-muted">
                    <TripPhoto src={a.url} alt="Image to send" sizes="56px" />
                    <button
                      type="button"
                      aria-label="Remove this image"
                      onClick={() => setAttachments((all) => all.filter((x) => x !== a))}
                      className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {uploading && (
                  <span className="grid size-14 place-items-center rounded-lg bg-muted">
                    <Spinner />
                  </span>
                )}
              </div>
            )
          }
          before={
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void attach(e.target.files)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Attach images"
                onClick={() => fileInput.current?.click()}
                disabled={busy || uploading}
                className="rounded-full"
              >
                <Paperclip />
              </Button>
            </>
          }
        />
      </ChatWindow>
    </PendingProposalProvider>
  );
}
