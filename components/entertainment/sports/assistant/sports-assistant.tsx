"use client";

import { useState } from "react";
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
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import type { SportsAssistantEvent } from "@/types/sports-assistant";

const SUGGESTIONS = [
  "When does Real Madrid play next?",
  "Add the NBA to my favourites",
  "Open the Champions League bracket",
];

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

  const chat = useAssistantChat<SportsAssistantEvent>({
    endpoint: "/api/sports/assistant",
    context: () => {
      const path = currentPath();
      return { key: path, value: { path } };
    },
    onEvent: (event, chat) => {
      switch (event.type) {
        case "navigate":
          if (event.href !== currentPath()) router.push(event.href);
          // The model was told where it sent the user.
          chat.markTold(event.href);
          return true;
        case "refresh":
          router.refresh();
          return true;
        default:
          return false;
      }
    },
  });
  const { entries, draft, setDraft, busy, status, input, scroller } = chat;
  const send = chat.send;
  const reset = chat.reset;

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
