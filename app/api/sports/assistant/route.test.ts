import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/services/impersonation", () => ({
  getEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));
vi.mock("@/lib/services/sports-service", () => ({
  listUserSportsFavorites: vi.fn(async () => [{ sportId: "nba" }, { sportId: "football" }]),
  setSportFavorite: vi.fn(),
}));
vi.mock("@/lib/utils/request-today", () => ({
  getRequestTodayIso: vi.fn(async () => "2026-10-25"),
  getRequestTimeZone: vi.fn(async () => "America/Costa_Rica"),
}));
vi.mock("@/lib/ai/assistant/converse", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/assistant/converse")>()),
  converse: vi.fn(),
}));
vi.mock("@/lib/services/ai-service", () => ({
  getAiSettings: vi.fn(async () => ({ model: "claude-sonnet-5-5", apiKeyExpiresOn: null })),
  recordAiUsage: vi.fn(async () => undefined),
}));
const afterCallbacks: (() => void)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (cb: () => void) => afterCallbacks.push(cb),
}));
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
}));

import type Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { converse } from "@/lib/ai/assistant/converse";
import { recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { describePage } from "@/lib/sports/assistant/context";
import type { SportsAssistantEvent } from "@/types/sports-assistant";

import { POST } from "./route";

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

const as = (realRole: string | null): void => {
  vi.mocked(getEffectiveContext).mockResolvedValue(
    realRole === null
      ? null
      : ({
          effectiveUserId: "user-1",
          realUser: { id: "admin-1" },
          realRole,
          isImpersonating: false,
        } as Awaited<ReturnType<typeof getEffectiveContext>>)
  );
};

const post = (body: unknown): Promise<Response> =>
  POST(new Request("http://localhost/api/sports/assistant", { method: "POST", body: JSON.stringify(body) }));

async function events(response: Response): Promise<SportsAssistantEvent[]> {
  return (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as SportsAssistantEvent);
}

const HELLO = { messages: [{ role: "user", content: "Hola" }] };

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("POST /api/sports/assistant", () => {
  it("wants a signed-in admin", async () => {
    as(null);
    expect((await post(HELLO)).status).toBe(401);
    as("user");
    expect((await post(HELLO)).status).toBe(403);
    as("provider");
    expect((await post(HELLO)).status).toBe(403);
    expect(converse).not.toHaveBeenCalled();
  });

  it("is off without an API key, even for an admin", async () => {
    as("admin");
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post(HELLO)).status).toBe(403);
  });

  it("refuses a body with no conversation, or a page outside the portal", async () => {
    as("admin");
    expect((await post({ messages: [] })).status).toBe(400);
    expect((await post({ ...HELLO, context: { path: "https://evil.test" } })).status).toBe(400);
  });

  it("tells the model the date, the page and the favourites, then hands the turn back", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ added, send, system, tools }) => {
      expect(system).toMatch(/sports assistant/);
      expect((tools as Anthropic.Beta.BetaTool[]).map((t) => t.name)).toEqual([
        "list_sports",
        "get_sport",
        "list_pages",
        "navigate",
        "set_favorite",
      ]);
      send({ type: "text", text: "Hola" });
      added.push({ role: "assistant", content: "Hola" });
    });

    const out = await events(
      await post({ ...HELLO, context: { path: "/portal/entertainment/sports?sport=football&league=la-liga" } })
    );

    expect(out).toEqual([
      { type: "text", text: "Hola" },
      {
        type: "turn",
        messages: [
          {
            role: "system",
            content:
              "Today is 2026-10-25 (time zone America/Costa_Rica). The user has /portal/entertainment/sports?sport=football&league=la-liga open: the sports hub, sport football, competition la-liga (LaLiga), tab the page's default. Their favourite sports: NBA, Football.",
          },
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
      feature: "sports-assistant",
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });

  it("changes a favourite for the effective user and expires the favourites' pages once it has answered", async () => {
    as("admin");
    vi.mocked(converse).mockImplementation(async ({ runTool }) => {
      await runTool({ type: "tool_use", id: "t1", name: "set_favorite", input: { sportId: "mlb", favorite: true } } as never);
    });
    const out = await events(await post(HELLO));

    expect(out).toContainEqual({ type: "refresh" });
    expect(revalidatePath).not.toHaveBeenCalled();
    afterCallbacks.forEach((cb) => cb());
    expect(revalidatePath).toHaveBeenCalledWith("/portal/entertainment/sports");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });

  it("expires nothing when no favourite changed", async () => {
    as("admin");
    vi.mocked(converse).mockResolvedValue(undefined);
    await (await post(HELLO)).text();
    afterCallbacks.forEach((cb) => cb());
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("describePage", () => {
  it("reads the hub with no sport named as the first favourite's", () => {
    expect(describePage("/portal/entertainment/sports", ["nba"])).toMatch(/sport nba, tab the page's default/);
    expect(describePage("/portal/entertainment/sports", [])).toMatch(/sport football, competition uefa-champions-league/);
  });

  it("names a race, a tournament and the rest of the portal", () => {
    expect(describePage("/portal/entertainment/sports/f1/7?tab=results", [])).toMatch(/the page of F1 round 7/);
    expect(describePage("/portal/entertainment/sports/tennis/atp-rg", [])).toMatch(/tennis tournament with id atp-rg/);
    expect(describePage("/portal/plans", [])).toBe("The user has /portal/plans open.");
  });
});
