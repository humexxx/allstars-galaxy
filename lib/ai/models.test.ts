import { describe, expect, it } from "vitest";

import { aiCost, aiModel, DEFAULT_AI_MODEL } from "./models";

describe("aiCost", () => {
  it("prices a call's fresh, cached and written tokens at the model's rates", () => {
    // Opus 5.5: $4 in, $20 out, $0.20 cache read, cache writes 1.25 × input.
    const cost = aiCost(aiModel("claude-opus-5-5"), {
      input_tokens: 1_000,
      output_tokens: 500,
      cache_creation_input_tokens: 2_000,
      cache_read_input_tokens: 10_000,
    });
    expect(cost).toBeCloseTo((1_000 * 4 + 2_000 * 5 + 10_000 * 0.2 + 500 * 20) / 1e6, 10);
  });

  it("adds a cent for each web search", () => {
    expect(
      aiCost(aiModel("claude-haiku-5-5"), {
        input_tokens: 0,
        output_tokens: 0,
        server_tool_use: { web_search_requests: 2 },
      })
    ).toBeCloseTo(0.02, 10);
  });

  it("treats missing cache counts as none", () => {
    expect(aiCost(aiModel("claude-haiku-5-5"), { input_tokens: 1e6, output_tokens: 0 })).toBe(0.1);
  });
});

describe("aiModel", () => {
  it("falls back to the default for a model that is no longer offered", () => {
    expect(aiModel("claude-old-1").id).toBe(DEFAULT_AI_MODEL);
    expect(aiModel(null).id).toBe(DEFAULT_AI_MODEL);
  });
});
