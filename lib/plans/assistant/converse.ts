import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { converse as converseWith } from "@/lib/ai/assistant/converse";
import { defineTool, ToolError, toolbox } from "@/lib/ai/assistant/tools";
import type { AiModel, AiTokenUsage } from "@/lib/ai/models";
import type { PlanOperationContext } from "@/lib/services/finance-plan-operations";
import {
  compareAssistantStrategies,
  getAssistantPlan,
  listAssistantPlans,
  PlanChangeError,
  previewPlanChanges,
} from "@/lib/services/plans-assistant-service";
import { planChangeSetSchema, planIdInputSchema, type PlanChangeSetInput } from "@/schemas/plans-assistant";
import type { PlansAssistantEvent, PlansAssistantMessage } from "@/types/plans-assistant";

import { PLANS_ASSISTANT_SYSTEM } from "./prompt";

export const PLANS_PATH = "/portal/plans";

/** The plans assistant's tools: each one's description and input beside what it runs. */
const plansTools = toolbox<PlanOperationContext, PlansAssistantEvent>(
  [
    defineTool({
      name: "list_plans",
      description:
        "The user's plans: id, name, whether it is the main plan, how many lines it has, and its outlook (net worth, cash, debt and money owed to the user today; the debt-free date; net worth in 12 months and at the end).",
      input: z.object({}),
      status: "Reading your plans",
      run: (_input, c) => listAssistantPlans(c),
    }),
    defineTool({
      name: "get_plan",
      description:
        "One plan in full: its settings, every income, expense and debt with its id and fields, the investment methods auto-invest can use (with their monthly ROI in percent), and its outlook.",
      input: planIdInputSchema,
      status: "Reading the plan",
      run: async ({ planId }, c) => {
        const plan = await getAssistantPlan(c, planId);
        if (!plan) throw new ToolError("No plan of the user's has that id");
        return plan;
      },
    }),
    defineTool({
      name: "compare_strategies",
      description:
        "The plan's debts paid off by avalanche, by snowball and with no extra payments, at the plan's own surplus share: interest paid, the month it is debt-free, and net worth at the end.",
      input: planIdInputSchema,
      status: "Comparing payoff strategies",
      run: async ({ planId }, c) => {
        const comparison = await compareAssistantStrategies(c, planId);
        if (!comparison) throw new ToolError("No plan of the user's has that id");
        return comparison;
      },
    }),
    defineTool({
      name: "open_plan",
      description:
        "Open a plan's page for the user. Do it first whenever the conversation turns to a plan that is not the one they have open.",
      input: planIdInputSchema,
      run: async ({ planId }, c, { send }) => {
        const plan = (await listAssistantPlans(c)).find((p) => (p as { id: string }).id === planId) as
          | { id: string; name: string }
          | undefined;
        if (!plan) throw new ToolError("No plan of the user's has that id");
        send({ type: "navigate", href: `${PLANS_PATH}/${plan.id}` });
        return `The user now has "${plan.name}" open.`;
      },
    }),
    defineTool({
      name: "propose_plan_changes",
      description:
        "Propose creating, changing or deleting plans and their incomes, expenses and debts, the main plan, and plan settings. The user sees each change and each plan's outlook before and after, and applies or discards it; nothing is written until they apply. Changes run in order, so a create_plan can be followed by add_* changes that name its ref.",
      input: planChangeSetSchema,
      // A whole plan with its lines is a large input; stream it as it is written.
      eagerInput: true,
      invalid: "The proposal is not valid.",
      status: "Working out what it would change",
      run: async (set, c, { tool, send }) => {
        try {
          const { lines, effects } = await previewPlanChanges(c, set);
          send({
            type: "proposal",
            proposal: { id: tool.id, set: tool.input as PlanChangeSetInput, lines, effects },
          });
        } catch (err) {
          if (err instanceof PlanChangeError) throw new ToolError(err.message);
          throw err;
        }
        return "The user now sees these changes and their effect on each plan, with Apply and Discard. Nothing is saved until they apply them; a note will say whether they did.";
      },
    }),
  ],
  "plans-assistant"
);

export const PLANS_ASSISTANT_TOOLS = plansTools.definitions;
export const runPlansTool = plansTools.run;

/**
 * The plans assistant's turn: the shared loop with the Plans pages' prompt
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
  context: PlanOperationContext;
  history: PlansAssistantMessage[];
  added: PlansAssistantMessage[];
  send: (event: PlansAssistantEvent) => void;
  record: (usage: AiTokenUsage, answeredBy: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  await converseWith({
    client,
    model,
    system: PLANS_ASSISTANT_SYSTEM,
    tools: PLANS_ASSISTANT_TOOLS,
    runTool: (tool) => runPlansTool(tool, context, send),
    history,
    added,
    send,
    record,
    tag: "plans-assistant",
    truncated: "Your output was cut off. Propose fewer changes at a time.",
    signal,
  });
}
