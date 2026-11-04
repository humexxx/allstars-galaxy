import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/impersonation", () => ({ getEffectiveContext: vi.fn() }));
vi.mock("@/lib/services/travel-assistant-service", () => ({
  listAssistantTrips: vi.fn(async () => [{ id: TRIP, title: "Orlando" }]),
}));
vi.mock("@/lib/utils/request-today", () => ({ getRequestTodayIso: vi.fn(async () => "2026-10-19") }));
vi.mock("@/lib/travel/assistant/converse", () => ({ converse: vi.fn() }));
vi.mock("@/lib/services/ai-service", () => ({
  getAiSettings: vi.fn(async () => ({ model: "claude-sonnet-5-5", apiKeyExpiresOn: null })),
  recordAiUsage: vi.fn(async () => undefined),
}));

import { recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { converse } from "@/lib/travel/assistant/converse";
import type { TravelAssistantEvent } from "@/types/travel-assistant";

import { POST } from "./route";

const TRIP = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

const as = (realRole: string | null): void => {
  vi.mocked(getEffectiveContext).mockResolvedValue(
    realRole === null
      ? null
      : ({
          effectiveUserId: "user-1",
          realUser: { id: "admin-1" },
          realRole,
        } as Awaited<ReturnType<typeof getEffectiveContext>>)
  );
};

const post = (body: unknown): Promise<Response> =>
  POST(new Request("http://localhost/api/travel/assistant", { method: "POST", body: JSON.stringify(body) }));

async function events(response: Response): Promise<TravelAssistantEvent[]> {
  return (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as TravelAssistantEvent);
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

describe("POST /api/travel/assistant", () => {
  it("wants a signed-in admin", async () => {
    as(null);
    expect((await post(HELLO)).status).toBe(401);
    as("user");
    expect((await post(HELLO)).status).toBe(403);
    expect(converse).not.toHaveBeenCalled();
  });

  it("refuses a body with no conversation", async () => {
    as("admin");
    expect((await post({ messages: [] })).status).toBe(400);
  });

  it("tells the model the date and the open trip, then hands the turn back", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ added, send }) => {
      send({ type: "text", text: "Hola" });
      added.push({ role: "assistant", content: "Hola" });
    });

    const out = await events(await post({ ...HELLO, context: { tripId: TRIP } }));

    expect(out).toEqual([
      { type: "text", text: "Hola" },
      {
        type: "turn",
        messages: [
          { role: "system", content: `Today is 2026-10-19. The user has the trip "Orlando" (id ${TRIP}) open.` },
          { role: "assistant", content: "Hola" },
        ],
      },
    ]);
  });

  it("answers with the model chosen in Settings and books the spend to the admin", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ model, record }) => {
      expect(model.id).toBe("claude-sonnet-5-5");
      await record({ input_tokens: 10, output_tokens: 5 }, "claude-sonnet-5-5");
    });
    await (await post(HELLO)).text();
    expect(recordAiUsage).toHaveBeenCalledWith({
      userId: "admin-1",
      feature: "travel-assistant",
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });

  it("drops a note that never got its reply, so the next message stays valid", async () => {
    as("admin");
    vi.mocked(converse).mockRejectedValue(new Error("boom"));
    const out = await events(await post({ ...HELLO, context: { tripId: null } }));
    expect(out).toEqual([
      { type: "error", message: "Something went wrong. Try again." },
      { type: "turn", messages: [] },
    ]);
  });
});
