"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { readEvents } from "@/lib/ai/assistant/stream";

/** What every assistant's chat shows; an assistant adds its own kinds (a proposal card). */
export type BaseEntry =
  | { kind: "user"; id: string; text: string; images?: string[] }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "error"; id: string; message: string };

/** The events every assistant's stream carries; each adds its own. */
type BaseEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "turn"; messages: unknown[] }
  | { type: "error"; message: string };

type Message = { role: "user" | "assistant" | "system"; content: unknown };

let nextId = 0;
const newId = (): string => `assistant-entry-${++nextId}`;

export type AssistantChat<Extra extends { kind: string; id: string }> = {
  entries: (BaseEntry | Extra)[];
  setEntries: React.Dispatch<React.SetStateAction<(BaseEntry | Extra)[]>>;
  draft: string;
  setDraft: (draft: string) => void;
  busy: boolean;
  status: string | null;
  /** The message box, focused when the window opens. */
  input: RefObject<HTMLTextAreaElement | null>;
  /** The scrolling list, kept at its bottom as the answer grows. */
  scroller: RefObject<HTMLDivElement | null>;
  /**
   * Sends one message. `content` replaces the plain text block (images, a
   * note about them); `images` are shown in the user's bubble.
   */
  send: (text: string, options?: { content?: unknown[]; images?: string[] }) => Promise<void>;
  /** Something the model must hear on the next message (what the user did with a card). */
  note: (text: string) => void;
  /** Starts a new assistant bubble, so text that follows lands below a card. */
  breakText: () => void;
  /** The model already knows the user is on this page (it sent them there). */
  markTold: (key: string) => void;
  newId: () => string;
  reset: () => void;
};

/**
 * One assistant's chat state, shared by Travel, Sports and Plans: what the
 * user sees (`entries`), the conversation as the API keeps it (sent back to
 * the server untouched on every message), the notes owed to the model, and
 * the page context, sent only when it changed since the model was last told.
 *
 * The stream's common events are handled here; `onEvent` gets every event
 * first and returns true for the ones it handled itself (a proposal, a
 * navigation).
 */
export function useAssistantChat<
  Event extends { type: string },
  Extra extends { kind: string; id: string } = never,
>({
  endpoint,
  context,
  onEvent,
}: {
  endpoint: string;
  /** The page the user is on: `key` says whether it changed, `value` is what is sent. */
  context: () => { key: string; value: unknown };
  onEvent?: (event: Event, chat: AssistantChat<Extra>) => boolean;
}): AssistantChat<Extra> {
  const [entries, setEntries] = useState<(BaseEntry | Extra)[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const transcript = useRef<Message[]>([]);
  const notes = useRef<string[]>([]);
  /** The context key the model was last told; null before the first message. */
  const told = useRef<string | null>(null);
  const assistantId = useRef(newId());

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, status]);

  const appendText = (text: string): void => {
    const id = assistantId.current;
    setEntries((all) => {
      const at = all.findIndex((e) => e.id === id);
      if (at === -1) return [...all, { kind: "assistant", id, text }];
      const entry = all[at];
      if (entry.kind !== "assistant") return all;
      const next = [...all];
      next[at] = { kind: "assistant", id, text: (entry as { text: string }).text + text };
      return next;
    });
  };

  const fail = (message: string): void =>
    setEntries((all) => [...all, { kind: "error", id: newId(), message }]);

  const chat: AssistantChat<Extra> = {
    entries,
    setEntries,
    draft,
    setDraft,
    busy,
    status,
    input,
    scroller,
    note: (text) => {
      notes.current.push(text);
    },
    breakText: () => {
      assistantId.current = newId();
    },
    markTold: (key) => {
      told.current = key;
    },
    newId,
    reset: () => {
      setEntries([]);
      transcript.current = [];
      notes.current = [];
      told.current = null;
    },
    send: async (text, options = {}) => {
      const message = text.trim();
      if (!message || busy) return;
      setDraft("");
      setBusy(true);
      setEntries((all) => [
        ...all,
        { kind: "user", id: newId(), text: message, ...(options.images?.length ? { images: options.images } : {}) },
      ]);

      const content = [
        ...notes.current.map((t) => ({ type: "text", text: t })),
        ...(options.content ?? [{ type: "text", text: message }]),
      ];
      notes.current = [];
      const history: Message[] = [...transcript.current, { role: "user", content }];
      transcript.current = history;
      const page = context();
      const sendContext = told.current !== page.key;
      told.current = page.key;

      assistantId.current = newId();
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context: sendContext ? page.value : undefined }),
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "The assistant did not answer");
        }
        await readEvents<Event | BaseEvent>(response.body, (event) => {
          if (onEvent?.(event as Event, chat)) {
            setStatus(null);
            return;
          }
          const base = event as BaseEvent;
          switch (base.type) {
            case "text":
              setStatus(null);
              appendText(base.text);
              break;
            case "status":
              setStatus(base.label);
              break;
            case "turn":
              transcript.current = [...history, ...(base.messages as Message[])];
              break;
            case "error":
              fail(base.message);
              break;
          }
        });
      } catch (err) {
        fail(err instanceof Error ? err.message : "The assistant did not answer");
      } finally {
        setStatus(null);
        setBusy(false);
      }
    },
  };

  return chat;
}
