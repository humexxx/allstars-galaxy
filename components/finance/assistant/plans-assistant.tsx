"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyPlanChangesAction } from "@/app/actions/plans-assistant";
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
import type { PlanProposal, PlansAssistantEvent } from "@/types/plans-assistant";

import { PlanProposalCard, type PlanProposalState } from "./plan-proposal-card";

type ProposalEntry = {
  kind: "proposal";
  id: string;
  proposal: PlanProposal;
  state: PlanProposalState;
  createdPlans?: { id: string; name: string }[];
  error?: string;
};

const SUGGESTIONS = [
  "Add a $1,200 rent on the 2nd of each month",
  "Which pays my debts off sooner, avalanche or snowball?",
  "Make a copy of this plan that puts 30% of the leftover into Safe Investment",
];

const PLANS = "/portal/plans";

/**
 * The plans assistant: a corner button on every Plans page that opens a
 * chat. It reads the user's plans, opens them, and proposes changes —
 * plans, incomes, expenses, debts, strategy and settings — that are written
 * only when the user presses Apply on the card, which also shows what each
 * change does to the debt-free date and net worth.
 *
 * Mounted by the Plans layout, so the conversation survives moving between
 * the list, a plan and the compare view. What the user did with a card
 * reaches the model as a note on their next message.
 */
export function PlansAssistant(): React.ReactElement {
  const params = useParams<{ id?: string }>();
  const planId = typeof params.id === "string" && params.id !== "new" ? params.id : null;
  const router = useRouter();
  const pathname = usePathname();
  const phone = useIsMobile();
  const [open, setOpen] = useState(false);

  const chat = useAssistantChat<PlansAssistantEvent, ProposalEntry>({
    endpoint: "/api/plans/assistant",
    context: () => ({ key: planId ?? "list", value: { planId } }),
    onEvent: (event, chat) => {
      switch (event.type) {
        case "proposal":
          chat.setEntries((all) => [
            // A newer proposal replaces one still waiting.
            ...all.map((e) => (e.kind === "proposal" && e.state === "open" ? { ...e, state: "cancelled" as const } : e)),
            { kind: "proposal", id: chat.newId(), proposal: event.proposal, state: "open" },
          ]);
          chat.breakText();
          return true;
        case "navigate":
          if (event.href !== pathname) router.push(event.href);
          return true;
        default:
          return false;
      }
    },
  });
  const { entries, setEntries, draft, setDraft, busy, status, input, scroller } = chat;

  const update = (id: string, patch: Partial<ProposalEntry>): void =>
    setEntries((all) => all.map((e) => (e.id === id && e.kind === "proposal" ? { ...e, ...patch } : e)));

  async function apply(entry: ProposalEntry): Promise<void> {
    update(entry.id, { state: "applying", error: undefined });
    const result = await applyPlanChangesAction(entry.proposal.set);
    if (!result.success) {
      update(entry.id, { state: "open", error: result.error });
      chat.note(`[Note: the user pressed Apply on "${entry.proposal.set.summary}" but it failed: ${result.error}]`);
      router.refresh();
      return;
    }
    const { createdPlans } = result.data;
    update(entry.id, { state: "applied", createdPlans });
    const created = createdPlans.map((p) => ` The new plan "${p.name}" has id ${p.id}.`).join("");
    chat.note(`[Note: the user applied "${entry.proposal.set.summary}"; it is saved.${created}]`);
    toast.success("Changes applied");
    // A new plan has a page of its own now.
    if (createdPlans[0]) router.push(`${PLANS}/${createdPlans[0].id}`);
    else router.refresh();
  }

  function cancel(entry: ProposalEntry): void {
    update(entry.id, { state: "cancelled" });
    chat.note(`[Note: the user discarded "${entry.proposal.set.summary}"; nothing was saved.]`);
  }

  return (
    <>
      <AssistantButton label="Open the plans assistant" onClick={() => setOpen(true)} hidden={open} />

      <ChatWindow open={open} onOpenChange={setOpen} phone={phone} slot="plans-assistant-window" focus={input}>
        <ChatHeader
          title="Plans assistant"
          description="Create or change plans, incomes, expenses and debts. Nothing is saved until you apply it."
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
                  <PlanProposalCard
                    key={entry.id}
                    proposal={entry.proposal}
                    state={entry.state}
                    error={entry.error}
                    createdPlans={entry.createdPlans}
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
          placeholder="Add a debt, change the strategy, compare plans…"
          label="Message the plans assistant"
          inputRef={input}
        />
      </ChatWindow>
    </>
  );
}
