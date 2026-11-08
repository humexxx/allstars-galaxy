import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/plans-assistant-service", () => {
  class PlanChangeError extends Error {}
  return {
    PlanChangeError,
    listAssistantPlans: vi.fn(async () => [{ id: PLAN, name: "Main" }]),
    getAssistantPlan: vi.fn(async () => null),
    compareAssistantStrategies: vi.fn(),
    previewPlanChanges: vi.fn(async () => ({ lines: [{ title: "Card" }], effects: [] })),
  };
});

import { getAssistantPlan, PlanChangeError, previewPlanChanges } from "@/lib/services/plans-assistant-service";
import type { PlansAssistantEvent } from "@/types/plans-assistant";

import { PLANS_ASSISTANT_TOOLS, runPlansTool } from "./converse";

const PLAN = "22222222-2222-4222-8222-222222222222";
const c = { userId: "user-1", today: new Date(Date.UTC(2026, 10, 3)), timeZone: "UTC" };

async function run(name: string, input: unknown) {
  const events: PlansAssistantEvent[] = [];
  const tool = { type: "tool_use", id: "toolu_1", name, input } as Anthropic.Beta.BetaToolUseBlock;
  const result = await runPlansTool(tool, c, (e) => events.push(e));
  return { result, events };
}

beforeEach(() => vi.clearAllMocks());

describe("plans assistant tools", () => {
  it("offers exactly the plan tools", () => {
    expect(PLANS_ASSISTANT_TOOLS.map((t) => t.name)).toEqual([
      "list_plans",
      "get_plan",
      "compare_strategies",
      "open_plan",
      "propose_plan_changes",
    ]);
  });

  it("answers an unknown plan as an error the model can act on", async () => {
    vi.mocked(getAssistantPlan).mockResolvedValueOnce(null);
    const { result } = await run("get_plan", { planId: PLAN });
    expect(result).toMatchObject({ is_error: true, content: "No plan of the user's has that id" });
  });

  it("opens a plan's page", async () => {
    const { result, events } = await run("open_plan", { planId: PLAN });
    expect(events).toContainEqual({ type: "navigate", href: `/portal/plans/${PLAN}` });
    expect(result.content).toBe('The user now has "Main" open.');
  });

  it("streams a proposal card and saves nothing", async () => {
    const set = { summary: "Faster", changes: [{ op: "set_main_plan", planId: PLAN }] };
    const { result, events } = await run("propose_plan_changes", set);
    expect(previewPlanChanges).toHaveBeenCalledWith(c, expect.objectContaining({ summary: "Faster" }));
    expect(events).toContainEqual({
      type: "proposal",
      proposal: { id: "toolu_1", set, lines: [{ title: "Card" }], effects: [] },
    });
    expect(result.content).toMatch(/Nothing is saved until they apply/);
  });

  it("hands a refused proposal back to the model", async () => {
    vi.mocked(previewPlanChanges).mockRejectedValueOnce(new PlanChangeError("changes.0 (add_debt): bad"));
    const { result } = await run("propose_plan_changes", {
      summary: "Bad",
      changes: [{ op: "set_main_plan", planId: PLAN }],
    });
    expect(result).toMatchObject({ is_error: true, content: "changes.0 (add_debt): bad" });
  });
});
