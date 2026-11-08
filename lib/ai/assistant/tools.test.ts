import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineTool, ToolError, toolbox } from "./tools";

type Event = { type: "status"; label: string } | { type: "ping" };

const call = (name: string, input: unknown): Anthropic.Beta.BetaToolUseBlock =>
  ({ type: "tool_use", id: "toolu_1", name, input }) as Anthropic.Beta.BetaToolUseBlock;

const box = toolbox<{ userId: string }, Event>(
  [
    defineTool({
      name: "echo",
      description: "Says a word back.",
      input: z.object({ word: z.string().min(1) }),
      status: ({ word }) => `Echoing ${word}`,
      run: async ({ word }, { userId }, { send }) => {
        send({ type: "ping" });
        return { word, userId };
      },
    }),
    defineTool({
      name: "refuse",
      description: "Always refuses.",
      input: z.object({}),
      invalid: "The proposal is not valid.",
      run: async () => {
        throw new ToolError("Not that one");
      },
    }),
    defineTool({
      name: "crash",
      description: "Always breaks.",
      input: z.object({}),
      run: async () => {
        throw new Error("db down");
      },
    }),
  ],
  "test-assistant"
);

describe("toolbox", () => {
  it("tells the API each tool's name, description and JSON Schema", () => {
    const echo = box.definitions.find((d) => d.name === "echo")!;
    expect(echo.description).toBe("Says a word back.");
    expect(echo.input_schema).toMatchObject({
      type: "object",
      properties: { word: { type: "string" } },
      required: ["word"],
    });
  });

  it("runs a tool with its parsed input, streams its status, and answers with JSON", async () => {
    const events: Event[] = [];
    const result = await box.run(call("echo", { word: "hi" }), { userId: "u1" }, (e) => events.push(e));
    expect(events).toEqual([{ type: "status", label: "Echoing hi" }, { type: "ping" }]);
    expect(result).toMatchObject({ tool_use_id: "toolu_1", content: '{"word":"hi","userId":"u1"}' });
    expect(result.is_error).toBeUndefined();
  });

  it("refuses an invalid input before running anything, saying where", async () => {
    const send = vi.fn();
    const result = await box.run(call("echo", { word: "" }), { userId: "u1" }, send);
    expect(result).toMatchObject({ is_error: true, content: expect.stringMatching(/^The input is not valid\. word:/) });
    expect(send).not.toHaveBeenCalled();
  });

  it("answers a ToolError with its message and a crash with a generic one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await box.run(call("refuse", {}), { userId: "u1" }, vi.fn())).toMatchObject({
      is_error: true,
      content: "Not that one",
    });
    expect(await box.run(call("crash", {}), { userId: "u1" }, vi.fn())).toMatchObject({
      is_error: true,
      content: "That failed on the server. Try again, or tell the user.",
    });
  });

  it("names an unknown tool", async () => {
    expect(await box.run(call("nope", {}), { userId: "u1" }, vi.fn())).toMatchObject({
      is_error: true,
      content: "There is no tool called nope",
    });
  });
});
