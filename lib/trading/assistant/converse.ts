import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { converse as converseWith } from "@/lib/ai/assistant/converse";
import { defineTool, ToolError, toolbox } from "@/lib/ai/assistant/tools";
import type { AiModel, AiTokenUsage } from "@/lib/ai/models";
import {
  getAssistantJournal,
  previewTradingChanges,
  TradingChangeError,
} from "@/lib/services/trading-assistant-service";
import { tradingChangeSetSchema, type TradingChangeSetInput } from "@/schemas/trading-assistant";
import type { TradingAssistantEvent, TradingAssistantMessage } from "@/types/trading-assistant";

import { TRADING_ASSISTANT_SYSTEM } from "./prompt";

/** Whose journal, read on whose calendar. */
export type TradingAssistantContext = { userId: string; timeZone: string | null };

/** The trading assistant's tools: each one's description and input beside what it runs. */
const tradingTools = toolbox<TradingAssistantContext, TradingAssistantEvent>(
  [
    defineTool({
      name: "get_journal",
      description:
        "The trading journal: the balance, money deposited and withdrawn, realized P&L, the monthly growth pace, the stats (win rate, profit factor, expectancy, average win and loss, max drawdown), the last six months' P&L and return, the setups in use, every open trade, the latest 40 closed trades and the latest deposits and withdrawals, each with its id.",
      input: z.object({}),
      status: "Reading your journal",
      run: (_input, c) => getAssistantJournal(c.userId, c.timeZone),
    }),
    defineTool({
      name: "propose_journal_changes",
      description:
        "Propose opening, recording, closing, correcting or deleting trades, and deposits, withdrawals or their deletion. The user sees each change with its P&L and the account before and after, and applies or discards it; nothing is written until they apply. Changes run in order.",
      input: tradingChangeSetSchema,
      invalid: "The proposal is not valid.",
      status: "Working out what it would change",
      run: async (set, c, { tool, send }) => {
        try {
          const { lines, before, after } = await previewTradingChanges(c.userId, c.timeZone, set);
          send({
            type: "proposal",
            proposal: { id: tool.id, set: tool.input as TradingChangeSetInput, lines, before, after },
          });
        } catch (err) {
          if (err instanceof TradingChangeError) throw new ToolError(err.message);
          throw err;
        }
        return "The user now sees these changes and the account before and after, with Apply and Discard. Nothing is saved until they apply them; a note will say whether they did.";
      },
    }),
  ],
  "trading-assistant"
);

export const TRADING_ASSISTANT_TOOLS = tradingTools.definitions;
export const runTradingTool = tradingTools.run;

/**
 * The trading assistant's turn: the shared loop with the journal's prompt
 * and tools, every read and write scoped to the effective user.
 */
export async function converse({
  client,
  model,
  context,
  history,
  added,
  send,
  record,
  signal,
}: {
  client: Pick<Anthropic, "beta">;
  model: AiModel;
  context: TradingAssistantContext;
  history: TradingAssistantMessage[];
  added: TradingAssistantMessage[];
  send: (event: TradingAssistantEvent) => void;
  record: (usage: AiTokenUsage, answeredBy: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  await converseWith({
    client,
    model,
    system: TRADING_ASSISTANT_SYSTEM,
    tools: TRADING_ASSISTANT_TOOLS,
    runTool: (tool) => runTradingTool(tool, context, send),
    history,
    added,
    send,
    record,
    tag: "trading-assistant",
    truncated: "Your output was cut off. Propose fewer changes at a time.",
    signal,
  });
}
