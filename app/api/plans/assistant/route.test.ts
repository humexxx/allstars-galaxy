import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/impersonation", () => ({ getEffectiveContext: vi.fn() }));
vi.mock("@/lib/services/finance-plan-service", () => ({
  listUserPlans: vi.fn(async () => [{ id: PLAN, name: "Main" }]),
}));
vi.mock("@/lib/services/finance-plan-operations", () => ({
  planOperationContext: vi.fn(async (userId: string) => ({
    userId,
    timeZone: "UTC",
    today: new Date(Date.UTC(2026, 10, 3)),
  })),
}));
vi.mock("@/lib/plans/assistant/converse", () => ({ converse: vi.fn() }));
vi.mock("@/lib/services/ai-service", () => ({
  getAiSettings: vi.fn(async () => ({ model: "claude-sonnet-5-5", apiKeyExpiresOn: null })),
  recordAiUsage: vi.fn(async () => undefined),
}));

import { converse } from "@/lib/plans/assistant/converse";
import { recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import type { PlansAssistantEvent } from "@/types/plans-assistant";

import { POST } from "./route";

const PLAN = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

const as = (realRole: string | null): void => {
  vi.mocked(getEffectiveContext).mockResolvedValue(
    realRole === null
      ? null
      : ({ effectiveUserId: "user-1", realUser: { id: "admin-1" }, realRole } as Awaited<
          ReturnType<typeof getEffectiveContext>
        >)
  );
};

const post = (body: unknown): Promise<Response> =>
  POST(new Request("http://localhost/api/plans/assistant", { method: "POST", body: JSON.stringify(body) }));

async function events(response: Response): Promise<PlansAssistantEvent[]> {
  return (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as PlansAssistantEvent);
}

const HELLO = { messages: [{ role: "user", content: "Hola" }] };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("POST /api/plans/assistant", () => {
  it("wants a signed-in admin", async () => {
    as(null);
    expect((await post(HELLO)).status).toBe(401);
    as("user");
    expect((await post(HELLO)).status).toBe(403);
    expect(converse).not.toHaveBeenCalled();
  });

  it("tells the model today and the plan open, and plans for the effective user", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ added, send, context }) => {
      expect(context.userId).toBe("user-1");
      send({ type: "text", text: "Hola" });
      added.push({ role: "assistant", content: [{ type: "text", text: "Hola" }] });
    });

    const stream = await events(await post({ ...HELLO, context: { planId: PLAN } }));

    expect(stream[0]).toEqual({ type: "text", text: "Hola" });
    const turn = stream.at(-1) as Extract<PlansAssistantEvent, { type: "turn" }>;
    expect(turn.messages[0]).toEqual({
      role: "system",
      content: `Today is 2026-11-03. The user has the plan "Main" (id ${PLAN}) open.`,
    });
  });

  it("books the spend to the signed-in admin", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ record }) => {
      await record({ input_tokens: 10, output_tokens: 5 } as never, "claude-sonnet-5-5");
    });
    await events(await post(HELLO));
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", feature: "plans-assistant" })
    );
  });
});
