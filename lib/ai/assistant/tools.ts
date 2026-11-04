import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

import {
  toolFailed,
  toolInputSchema,
  toolOk,
  type AssistantToolResult,
  type AssistantToolUse,
} from "./converse";

/**
 * An assistant's tools, declared once: what the model reads (name,
 * description, the Zod schema of its input) next to what the server runs.
 * The shape an MCP server would expose, so a tool can move to one unchanged.
 *
 * Every tool is validated and answered the same way: an input the schema
 * refuses comes back as "The input is not valid. path: message", a
 * `ToolError` comes back as its message, anything else is logged and
 * answered as a server failure. A tool never throws into the loop.
 */
export type AssistantTool<Ctx, Event> = {
  name: string;
  description: string;
  input: z.ZodType;
  /** Stream a large input as the model writes it (a whole plan or trip). */
  eagerInput?: boolean;
  /** How a refused input starts ("The proposal is not valid."). */
  invalid?: string;
  /** What the chat shows while it runs; a function when it depends on the input. */
  status?: string | ((input: never) => string);
  run: (input: never, ctx: Ctx, io: ToolIo<Event>) => Promise<unknown>;
};

export type ToolIo<Event> = {
  /** The call being answered (its id names a proposal). */
  tool: AssistantToolUse;
  /** Streams an event to the browser: a status, a navigation, a card. */
  send: (event: Event) => void;
};

/**
 * Declares one tool. `run` gets the parsed input; what it returns is the
 * tool's result (a string as it is, anything else as JSON).
 */
export function defineTool<Ctx, Event, S extends z.ZodType>(tool: {
  name: string;
  description: string;
  input: S;
  eagerInput?: boolean;
  invalid?: string;
  status?: string | ((input: z.output<S>) => string);
  run: (input: z.output<S>, ctx: Ctx, io: ToolIo<Event>) => Promise<unknown>;
}): AssistantTool<Ctx, Event> {
  return tool as unknown as AssistantTool<Ctx, Event>;
}

/** An expected failure the model should read and act on (a bad id, a refused change). */
export class ToolError extends Error {}

/** A set of tools as the API is told about them, and the one dispatcher that runs them. */
export type Toolbox<Ctx, Event> = {
  definitions: Anthropic.Beta.BetaTool[];
  run: (tool: AssistantToolUse, ctx: Ctx, send: (event: Event) => void) => Promise<AssistantToolResult>;
};

export function toolbox<Ctx, Event extends { type: string }>(
  tools: AssistantTool<Ctx, Event>[],
  tag: string
): Toolbox<Ctx, Event> {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return {
    definitions: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: toolInputSchema(t.input),
      ...(t.eagerInput ? { eager_input_streaming: true } : {}),
    })),
    async run(tool, ctx, send) {
      const def = byName.get(tool.name);
      if (!def) return toolFailed(tool, `There is no tool called ${tool.name}`);
      const parsed = def.input.safeParse(tool.input ?? {});
      if (!parsed.success) return toolFailed(tool, invalidInput(parsed.error.issues, def.invalid));
      const input = parsed.data as never;
      try {
        if (def.status) {
          const label = typeof def.status === "function" ? def.status(input) : def.status;
          send({ type: "status", label } as unknown as Event);
        }
        return toolOk(tool, await def.run(input, ctx, { tool, send }));
      } catch (err) {
        if (err instanceof ToolError) return toolFailed(tool, err.message);
        console.error(`[${tag}] tool ${tool.name} failed:`, err);
        return toolFailed(tool, "That failed on the server. Try again, or tell the user.");
      }
    },
  };
}

/** The first few schema issues, each with where it is. */
export function invalidInput(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  lead = "The input is not valid."
): string {
  const detail = issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join(".") || "input"}: ${i.message}`)
    .join("; ");
  return `${lead} ${detail}`;
}
