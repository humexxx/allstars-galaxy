"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AssistantButton, ChatHeader, ChatWindow } from "@/components/assistant/chat-window";
import { Composer } from "@/components/assistant/composer";
import {
  AssistantBubble,
  AssistantError,
  AssistantStatus,
  Suggestions,
  UserBubble,
} from "@/components/assistant/messages";
import { useIsMobile } from "@/hooks/use-mobile";
import { readEvents } from "@/lib/ai/assistant/stream";
import type { SportsAssistantEvent, SportsAssistantMessage } from "@/types/sports-assistant";

type Entry =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "error"; id: string; message: string };

const SUGGESTIONS = [
  "When does Real Madrid play next?",
  "Add the NBA to my favourites",
  "Open the Champions League bracket",
];

let nextId = 0;
const newId = (): string => `sports-entry-${++nextId}`;

/** The address on screen, query included: the hub keeps its sport, league and tab there. */
function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * The sports assistant: a corner button on every Sports page that opens a
 * chat. It answers from the same feeds the pages show, opens pages for the
 * user, and adds or removes favourite sports.
 *
 * Mounted by the Sports layout, so the conversation survives moving between
 * the hub, a race and a tournament; another part of the portal unmounts it.
 * The conversation as the API keeps it (`transcript`) goes back to the server
 * untouched on every message, with a note on the page whenever it changed.
 */
export function SportsAssistant(): React.ReactElement {
  const router = useRouter();
  const phone = useIsMobile();

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const transcript = useRef<SportsAssistantMessage[]>([]);
  /** The page the model was last told about; null before the first message. */
  const toldPath = useRef<string | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, status]);

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

  async function send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setEntries((all) => [...all, { kind: "user", id: newId(), text: message }]);

    const history: SportsAssistantMessage[] = [
      ...transcript.current,
      { role: "user", content: [{ type: "text", text: message }] },
    ];
    transcript.current = history;
    const path = currentPath();
    const context = toldPath.current === path ? undefined : { path };
    toldPath.current = path;

    const assistantId = newId();
    try {
      const response = await fetch("/api/sports/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The assistant did not answer");
      }
      await readEvents<SportsAssistantEvent>(response.body, (event) => {
        switch (event.type) {
          case "text":
            setStatus(null);
            appendText(assistantId, event.text);
            break;
          case "status":
            setStatus(event.label);
            break;
          case "navigate":
            if (event.href !== currentPath()) router.push(event.href);
            // The model was told where it sent the user.
            toldPath.current = event.href;
            break;
          case "refresh":
            router.refresh();
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

  function reset(): void {
    setEntries([]);
    transcript.current = [];
    toldPath.current = null;
  }

  return (
    <>
      <AssistantButton label="Open the sports assistant" onClick={() => setOpen(true)} hidden={open} />

      <ChatWindow open={open} onOpenChange={setOpen} phone={phone} slot="sports-assistant-window" focus={input}>
        <ChatHeader
          title="Sports assistant"
          description="Ask about results, tables and news, find a page, or change your favourite sports."
          onReset={entries.length > 0 ? reset : undefined}
          busy={busy}
        />

        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {entries.length === 0 && (
            <Suggestions
              items={SUGGESTIONS}
              onPick={(text) => {
                setDraft(text);
                input.current?.focus();
              }}
            />
          )}

          {entries.map((entry) => {
            switch (entry.kind) {
              case "user":
                return <UserBubble key={entry.id} text={entry.text} />;
              case "assistant":
                return <AssistantBubble key={entry.id} text={entry.text} />;
              case "error":
                return <AssistantError key={entry.id} message={entry.message} />;
            }
          })}

          {busy && <AssistantStatus label={status} />}
        </div>

        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void send(draft)}
          busy={busy}
          canSend={!busy && Boolean(draft.trim())}
          placeholder="Ask about a game, a table, a page…"
          label="Message the sports assistant"
          inputRef={input}
        />
      </ChatWindow>
    </>
  );
}
