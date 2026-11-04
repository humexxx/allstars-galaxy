import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { AiModel, AiTokenUsage } from "@/lib/ai/models";

/** Model calls one message may make: reads, an action, a retry and an answer fit easily. */
const MAX_CALLS = 8;

type Block = Anthropic.Beta.BetaContentBlock;

/** A conversation as the API stores it; the browser keeps it and sends it back. */
export type AssistantMessage = Anthropic.Beta.BetaMessageParam;
export type AssistantToolUse = Anthropic.Beta.BetaToolUseBlock;
export type AssistantToolResult = Anthropic.Beta.BetaToolResultBlockParam;

/** The events every assistant streams; each one adds its own on top. */
export type AssistantBaseEvent = { type: "text"; text: string } | { type: "status"; label: string };

/**
 * One user message's worth of conversation: model calls and tool runs until
 * the model answers in words.
 *
 * Append-only by design. Everything the turn adds goes onto `added` exactly
 * as the API returned it, the browser stores it, and the next request sends
 * it back unchanged — the model's reasoning stays valid only on a history
 * nobody has edited.
 */
export async function converse({
  client,
  model,
  system,
  tools,
  runTool,
  history,
  added,
  send,
  record,
  tag,
  truncated = "Your output was cut off. Try a smaller step.",
  signal,
}: {
  client: Pick<Anthropic, "beta">;
  /** The model the admins picked in Settings. */
  model: AiModel;
  /** Fixed text, so the prompt cache holds across every turn. */
  system: string;
  tools: Anthropic.Beta.BetaToolUnion[];
  /** Runs one of the app's own tools; every call gets a result, an error included. */
  runTool: (tool: AssistantToolUse) => Promise<AssistantToolResult>;
  history: AssistantMessage[];
  added: AssistantMessage[];
  send: (event: AssistantBaseEvent) => void;
  /**
   * Books each call's tokens against the month's credit, under the model
   * that answered: after a safety fallback that is not the one asked for.
   */
  record: (usage: AiTokenUsage, answeredBy: string) => Promise<void>;
  /** Names the assistant in the server's log. */
  tag: string;
  /** What a tool call cut off by the token limit is answered with. */
  truncated?: string;
  signal?: AbortSignal;
}): Promise<void> {
  let parseRetries = 0;

  for (let call = 0; call < MAX_CALLS; call++) {
    const stream = client.beta.messages.stream(
      {
        model: model.id,
        max_tokens: 16000,
        // A safety decline is retried on the model Anthropic picks for it,
        // inside the same call, instead of ending the conversation.
        ...(model.fallbacks
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system,
        tools,
        messages: [...history, ...added],
      },
      { signal }
    );
    stream.on("text", (text) => send({ type: "text", text }));
    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const query = (block.input as { query?: unknown }).query;
        send({ type: "status", label: typeof query === "string" ? `Searching the web: ${query}` : "Searching the web" });
      }
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      parseRetries = 0;
    } catch (err) {
      // Only a tool input too broken to parse is worth asking again; the
      // turn was never appended, so the retry starts from the same history.
      if (err instanceof Anthropic.APIError || signal?.aborted || parseRetries++ >= 2) throw err;
      continue;
    }

    // Billed whatever happens next, so counted before anything can return.
    await record(message.usage, message.model).catch((err: unknown) =>
      console.error(`[${tag}] usage not recorded:`, err)
    );

    const content = echoable(message.content);
    added.push({ role: "assistant", content });

    // A long web search hands the turn back unfinished; sending it back as
    // it is lets the model carry on where it stopped.
    if (message.stop_reason === "pause_turn") continue;

    // A decline can cut a tool call off mid-input: never run that turn's tools.
    if (message.stop_reason === "refusal") {
      send({ type: "text", text: "I can't help with that one." });
      return;
    }

    const toolUses = content.filter((b): b is AssistantToolUse => b.type === "tool_use");
    if (toolUses.length === 0) return;

    const results: AssistantToolResult[] =
      message.stop_reason === "max_tokens"
        ? // A truncated input can still parse; answer every call so the
          // history stays valid, and let the model try a smaller one.
          toolUses.map((tool) => toolFailed(tool, truncated))
        : await Promise.all(
            toolUses.map((tool) =>
              runTool(tool).catch((err: unknown) => {
                console.error(`[${tag}] tool failed:`, err);
                return toolFailed(tool, "That failed on the server. Try again, or tell the user.");
              })
            )
          );
    added.push({ role: "user", content: results });
  }

  send({ type: "text", text: "\n\nI stopped there. Ask me to carry on." });
}

/**
 * The response as it may be sent back.
 *
 * After a mid-answer fallback, what the declining model wrote before the
 * `fallback` block is not part of the conversation the fallback model
 * continued: its reasoning and its tool calls are dropped (text stays). Its
 * tool calls are therefore never run either.
 */
export function echoable(content: Block[]): Block[] {
  const boundary = content.map((b) => b.type).lastIndexOf("fallback");
  if (boundary === -1) return content;
  return content.filter(
    (b, i) =>
      i >= boundary || !(b.type === "thinking" || b.type === "redacted_thinking" || b.type === "tool_use")
  );
}

export function toolFailed(tool: AssistantToolUse, message: string): AssistantToolResult {
  return { type: "tool_result", tool_use_id: tool.id, is_error: true, content: message };
}

export function toolOk(tool: AssistantToolUse, content: unknown): AssistantToolResult {
  return {
    type: "tool_result",
    tool_use_id: tool.id,
    content: typeof content === "string" ? content : JSON.stringify(content),
  };
}

/** A Zod schema as the tool's JSON Schema — the shape the model is told to send. */
export function toolInputSchema(schema: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Beta.BetaTool.InputSchema;
}
