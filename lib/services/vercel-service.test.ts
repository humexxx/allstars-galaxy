import { afterEach, describe, expect, it, vi } from "vitest";

import { listVercelProjects } from "./vercel-service";

const ORIGINAL = process.env.VERCEL_API_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL === undefined) delete process.env.VERCEL_API_TOKEN;
  else process.env.VERCEL_API_TOKEN = ORIGINAL;
});

describe("listVercelProjects", () => {
  it("reads the token per call, not at import", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ projects: [] }) }));
    vi.stubGlobal("fetch", fetchMock);

    delete process.env.VERCEL_API_TOKEN;
    expect(await listVercelProjects()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.VERCEL_API_TOKEN = "token-set-after-import";
    await listVercelProjects();
    expect(fetchMock).toHaveBeenCalled();
  });
});
