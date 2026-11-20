import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

import { aiModel } from "@/lib/ai/models";

import {
  converse,
  echoable,
  toolFailed,
  toolOk,
  type AssistantBaseEvent,
  type AssistantMessage,
  type AssistantToolUse,
} from "./converse";

type Block = Anthropic.Beta.BetaContentBlock;
type Turn = { content: Block[]; stop_reason: string };

const text = (t: string) => ({ type: "text", text: t, citations: null }) as Block;
const toolUse = (name: string, input: unknown, id: string) => ({ type: "tool_use", id, name, input }) as Block;

function fakeClient(turns: Turn[]) {
  const params: Record<string, unknown>[] = [];
  const stream = vi.fn((p: Record<string, unknown>) => {
    params.push(p);
    const turn = turns.shift()!;
    return {
      on: () => undefined,
      finalMessage: async () => ({
        content: turn.content,
        stop_reason: turn.stop_reason,
        usage: { input_tokens: 1, output_tokens: 1 },
        model: p.model,
      }),
    };
  });
  return { client: { beta: { messages: { stream } } } as unknown as Pick<Anthropic, "beta">, params };
}

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "echo", description: "Echo", input_schema: { type: "object", properties: {} } },
];

async function run(turns: Turn[], runTool: (tool: AssistantToolUse) => Promise<Anthropic.Beta.BetaToolResultBlockParam>) {
  const { client, params } = fakeClient(turns);
  const added: AssistantMessage[] = [];
  const events: AssistantBaseEvent[] = [];
  await converse({
    client,
    model: aiModel("claude-opus-5-5"),
    system: "You echo.",
    tools: TOOLS,
    runTool,
    history: [{ role: "user", content: "Hi" }],
    added,
    send: (e) => events.push(e),
    record: async () => undefined,
    tag: "test-assistant",
  });
  return { added, events, params };
}

describe("converse", () => {
  it("sends the caller's prompt and tools, and hands every tool call to its runTool", async () => {
    const runTool = vi.fn(async (tool: AssistantToolUse) => toolOk(tool, { echoed: tool.input }));
    const { added, params } = await run(
      [
        { content: [toolUse("echo", { a: 1 }, "t1"), toolUse("echo", { a: 2 }, "t2")], stop_reason: "tool_use" },
        { content: [text("Done")], stop_reason: "end_turn" },
      ],
      runTool
    );

    expect(params[0]).toMatchObject({ system: "You echo.", tools: TOOLS });
    expect(runTool).toHaveBeenCalledTimes(2);
    expect(added[1]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: '{"echoed":{"a":1}}' },
        { type: "tool_result", tool_use_id: "t2", content: '{"echoed":{"a":2}}' },
      ],
    });
  });

  it("answers a tool that throws with an error, so the history stays valid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { added } = await run(
      [
        { content: [toolUse("echo", {}, "t1")], stop_reason: "tool_use" },
        { content: [text("Sorry")], stop_reason: "end_turn" },
      ],
      async () => {
        throw new Error("boom");
      }
    );
    expect((added[1].content as Anthropic.Beta.BetaToolResultBlockParam[])[0]).toMatchObject({
      tool_use_id: "t1",
      is_error: true,
    });
  });

  it("answers a cut-off tool call without running it", async () => {
    const runTool = vi.fn(async (tool: AssistantToolUse) => toolFailed(tool, "no"));
    const { added } = await run(
      [
        { content: [toolUse("echo", {}, "t1")], stop_reason: "max_tokens" },
        { content: [text("Ok")], stop_reason: "end_turn" },
      ],
      runTool
    );
    expect(runTool).not.toHaveBeenCalled();
    expect((added[1].content as Anthropic.Beta.BetaToolResultBlockParam[])[0]).toMatchObject({
      is_error: true,
      content: "Your output was cut off. Try a smaller step.",
    });
  });
});

describe("echoable", () => {
  it("drops what the declining model began before a fallback, text aside", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "s" },
      text("Partial"),
      toolUse("get_trip", {}, "t1"),
      { type: "fallback", from: {}, to: {}, trigger: {} },
      text("Done"),
    ] as unknown as Block[];
    expect(echoable(content).map((b) => b.type)).toEqual(["text", "fallback", "text"]);
  });

  it("leaves an ordinary answer alone", () => {
    const content = [text("a"), toolUse("list_trips", {}, "t1")];
    expect(echoable(content)).toBe(content);
  });
});

describe("converse's time budget", () => {
  it("starts no new model call within the route's last 20 seconds", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { client, params } = fakeClient([
      { content: [toolUse("echo", {}, "t1")], stop_reason: "tool_use" },
      { content: [text("never asked for")], stop_reason: "end_turn" },
    ]);
    const events: AssistantBaseEvent[] = [];
    const runTool = vi.fn(async (tool: AssistantToolUse) => {
      now.mockReturnValue(1_000_000 + 101_000);
      return toolOk(tool, "slow");
    });

    await converse({
      client,
      model: aiModel("claude-opus-5-5"),
      system: "s",
      tools: TOOLS,
      runTool,
      history: [{ role: "user", content: "Hi" }],
      added: [],
      send: (e) => events.push(e),
      record: async () => undefined,
      tag: "test-assistant",
    });
    now.mockRestore();

    expect(params).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "text", text: expect.stringContaining("ran out of time") });
  });

  it("books the tokens a failed stream already used", async () => {
    const usage = { input_tokens: 900, output_tokens: 40 };
    const stream = vi.fn(() => ({
      on: () => undefined,
      currentMessage: { usage, model: "claude-opus-5-5" },
      finalMessage: async () => {
        throw new APIError();
      },
    }));
    class APIError extends (await import("@anthropic-ai/sdk")).default.APIError {
      constructor() {
        super(500, undefined, "boom", new Headers());
      }
    }
    const record = vi.fn(async () => undefined);

    await expect(
      converse({
        client: { beta: { messages: { stream } } } as unknown as Pick<Anthropic, "beta">,
        model: aiModel("claude-opus-5-5"),
        system: "s",
        tools: TOOLS,
        runTool: async (tool) => toolOk(tool, ""),
        history: [{ role: "user", content: "Hi" }],
        added: [],
        send: () => undefined,
        record,
        tag: "test-assistant",
      })
    ).rejects.toThrow();
    expect(record).toHaveBeenCalledWith(usage, "claude-opus-5-5");
  });
});

