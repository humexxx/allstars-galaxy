"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { ArrowUp, Paperclip, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { applyTravelChangesAction, undoTravelChangesAction } from "@/app/actions/travel-assistant";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { readEvents } from "@/lib/travel/assistant/stream";
import { uploadTripPhoto, type UploadedPhoto } from "@/lib/travel/photo-upload";
import { cn } from "@/lib/utils";
import type {
  TravelAssistantEvent,
  TravelAssistantMessage,
  TravelChangeLine,
  TravelProposal,
} from "@/types/travel-assistant";

type TravelAssistantContent = Exclude<TravelAssistantMessage["content"], string>[number];

import { TripPhoto } from "../trip-photo";
import { ProposalCard, type ProposalState } from "./proposal-card";
import { VoiceButton } from "./voice-button";

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
 */
export function TravelAssistant() {
  const params = useParams<{ id?: string }>();
  const tripId = typeof params.id === "string" && params.id !== "new" ? params.id : null;

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  /** What was typed before dictation started; the transcript goes after it. */
  const voiceBase = useRef("");

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
      await readEvents(response.body, (event: TravelAssistantEvent) => {
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
            setEntries((all) => [
              ...all,
              { kind: "proposal", id: newId(), proposal: event.proposal, state: "open" },
            ]);
            assistantId = newId();
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
  }

  async function apply(entry: ProposalEntry): Promise<void> {
    update(entry.id, { state: "applying", error: undefined });
    const result = await applyTravelChangesAction(entry.proposal.set);
    if (!result.success) {
      update(entry.id, { state: "open", error: result.error });
      notes.current.push(`[Note: the user pressed Apply on "${entry.proposal.set.summary}" but it failed: ${result.error}. Nothing was saved.]`);
      return;
    }
    update(entry.id, { state: "applied", applied: result.data.lines, undoToken: result.data.undoToken });
    const created = result.data.lines
      .filter((l) => l.subject === "trip" && l.action === "add" && l.tripId)
      .map((l) => ` The new trip "${l.title}" has id ${l.tripId}.`)
      .join("");
    notes.current.push(`[Note: the user applied "${entry.proposal.set.summary}"; it is saved.${created}]`);
  }

  function cancel(entry: ProposalEntry): void {
    update(entry.id, { state: "cancelled" });
    notes.current.push(`[Note: the user cancelled "${entry.proposal.set.summary}"; nothing was saved.]`);
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
  }

  function reset(): void {
    setEntries([]);
    transcript.current = [];
    notes.current = [];
    toldTripId.current = undefined;
  }

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    void send(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  // Only the newest receipt can be undone: undoing an older one would put
  // back fields a later change has since moved on from.
  const lastApplied = entries.findLast(
    (e): e is ProposalEntry => e.kind === "proposal" && (e.state === "applied" || e.state === "undoing")
  )?.id;

  return (
    <>
      <Button
        size="icon-lg"
        aria-label="Open the travel assistant"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 size-12 rounded-full shadow-lg",
          // Clear of the dev-tools wrench, which only exists in development.
          process.env.NODE_ENV === "development" ? "bottom-16" : "bottom-4"
        )}
      >
        <Sparkles />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="border-b pr-12">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles aria-hidden className="size-4 text-primary" /> Travel assistant
              </SheetTitle>
              {entries.length > 0 && (
                <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                  <RotateCcw />
                  New chat
                </Button>
              )}
            </div>
            <SheetDescription>
              Describe a trip or a change. Nothing is saved until you apply it.
            </SheetDescription>
          </SheetHeader>

          <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {entries.length === 0 && (
              <div className="flex flex-col gap-2">
                <Text variant="muted">Try something like:</Text>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft(s)}
                    className="rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {entries.map((entry) => {
              switch (entry.kind) {
                case "user":
                  return (
                    <div key={entry.id} className="ml-8 flex flex-col items-end gap-1 self-end">
                      {entry.images.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {entry.images.map((url) => (
                            <span key={url} className="relative block size-16 overflow-hidden rounded-lg bg-muted">
                              <TripPhoto src={url} alt="Attached image" sizes="64px" />
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {entry.text}
                      </p>
                    </div>
                  );
                case "assistant":
                  return (
                    <p key={entry.id} className="mr-8 whitespace-pre-wrap text-sm">
                      {entry.text}
                    </p>
                  );
                case "error":
                  return (
                    <Text key={entry.id} variant="small" className="text-destructive">
                      {entry.message}
                    </Text>
                  );
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

            {busy && (
              <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                {status ?? "Thinking"}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t p-4">
            {(attachments.length > 0 || uploading) && (
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
            )}
            <div className="flex items-end gap-1">
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
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Plan a trip, add a booking, change dates…"
                aria-label="Message the travel assistant"
                rows={2}
                className="min-w-0 flex-1 resize-none"
              />
              <VoiceButton
                disabled={busy}
                onStart={() => {
                  voiceBase.current = draft.trim() ? `${draft.trim()} ` : "";
                }}
                onTranscript={(words) => setDraft(voiceBase.current + words)}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send"
                disabled={busy || uploading || (!draft.trim() && attachments.length === 0)}
              >
                <ArrowUp />
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
