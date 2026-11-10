"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyTradingChangesAction } from "@/app/actions/trading-assistant";
import { AssistantButton, ChatHeader, ChatWindow } from "@/components/assistant/chat-window";
import { Composer } from "@/components/assistant/composer";
import {
  AssistantBubble,
  AssistantError,
  AssistantStatus,
  Suggestions,
  UserBubble,
} from "@/components/assistant/messages";
import { useAssistantChat } from "@/components/assistant/use-assistant-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TradingAssistantEvent, TradingProposal } from "@/types/trading-assistant";

import { TradingProposalCard, type TradingProposalState } from "./trading-proposal-card";

type ProposalEntry = {
  kind: "proposal";
  id: string;
  proposal: TradingProposal;
  state: TradingProposalState;
  error?: string;
};

const SUGGESTIONS = [
  "I bought 20 NVDA at 138.50 this morning",
  "Close my open trade at 142.30",
  "Deposit $2,000 into the account",
  "How is my trading going this month?",
];

/**
 * The trading assistant: a corner button on the journal that opens a chat.
 * It reads the journal and proposes trades, closes, corrections, deposits and
 * withdrawals, written only when the user presses Apply on the card — which
 * also shows what each change does to the balance.
 */
export function TradingAssistant(): React.ReactElement {
  const router = useRouter();
  const phone = useIsMobile();
  const [open, setOpen] = useState(false);

  const chat = useAssistantChat<TradingAssistantEvent, ProposalEntry>({
    endpoint: "/api/trading/assistant",
    context: () => ({ key: "journal", value: {} }),
    onEvent: (event, chat) => {
      if (event.type !== "proposal") return false;
      chat.setEntries((all) => [
        // A newer proposal replaces one still waiting.
        ...all.map((e) => (e.kind === "proposal" && e.state === "open" ? { ...e, state: "cancelled" as const } : e)),
        { kind: "proposal", id: chat.newId(), proposal: event.proposal, state: "open" },
      ]);
      chat.breakText();
      return true;
    },
  });
  const { entries, setEntries, draft, setDraft, busy, status, input, scroller } = chat;

  const update = (id: string, patch: Partial<ProposalEntry>): void =>
    setEntries((all) => all.map((e) => (e.id === id && e.kind === "proposal" ? { ...e, ...patch } : e)));

  async function apply(entry: ProposalEntry): Promise<void> {
    update(entry.id, { state: "applying", error: undefined });
    const result = await applyTradingChangesAction(entry.proposal.set);
    if (!result.success) {
      update(entry.id, { state: "open", error: result.error });
      chat.note(`[Note: the user pressed Apply on "${entry.proposal.set.summary}" but it failed: ${result.error}]`);
      return;
    }
    update(entry.id, { state: "applied" });
    chat.note(
      `[Note: the user applied "${entry.proposal.set.summary}"; it is saved. The balance is now ${result.data.balance.toFixed(2)}.]`
    );
    toast.success("Journal updated");
    router.refresh();
  }

  function cancel(entry: ProposalEntry): void {
    update(entry.id, { state: "cancelled" });
    chat.note(`[Note: the user discarded "${entry.proposal.set.summary}"; nothing was saved.]`);
  }

  return (
    <>
      <AssistantButton label="Open the trading assistant" onClick={() => setOpen(true)} hidden={open} />

      <ChatWindow open={open} onOpenChange={setOpen} phone={phone} slot="trading-assistant-window" focus={input}>
        <ChatHeader
          title="Trading assistant"
          description="Log, close or correct trades and move money. Nothing is saved until you apply it."
          onReset={entries.length > 0 ? chat.reset : undefined}
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
              case "proposal":
                return (
                  <TradingProposalCard
                    key={entry.id}
                    proposal={entry.proposal}
                    state={entry.state}
                    error={entry.error}
                    onApply={() => void apply(entry)}
                    onCancel={() => cancel(entry)}
                  />
                );
            }
          })}

          {busy && <AssistantStatus label={status} />}
        </div>

        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void chat.send(draft)}
          busy={busy}
          canSend={!busy && Boolean(draft.trim())}
          placeholder="Bought 10 AAPL at 182, close my NVDA…"
          label="Message the trading assistant"
          inputRef={input}
        />
      </ChatWindow>
    </>
  );
}
