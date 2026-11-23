import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getClaims } })),
}));

import { proxy } from "./proxy";
import { decodeSessionUser, SESSION_USER_HEADER } from "@/lib/auth/session-header";

const forwarded = (response: Response): string | null =>
  response.headers.get(`x-middleware-request-${SESSION_USER_HEADER}`);

afterEach(() => {
  getClaims.mockReset();
});

describe("proxy", () => {
  it("hands the verified user on with the request", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "a@b.test", user_metadata: {} } }, error: null });
    const response = await proxy(new NextRequest("http://localhost/portal"));
    expect(decodeSessionUser(forwarded(response))).toEqual({ id: "u1", email: "a@b.test", user_metadata: {} });
  });

  it("drops a hand-off the browser forged and sends a signed-out reader to log in", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const forged = new NextRequest("http://localhost/portal", {
      headers: { [SESSION_USER_HEADER]: encodeURIComponent(JSON.stringify({ id: "admin" })) },
    });
    const response = await proxy(forged);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(forwarded(response)).toBeNull();
  });

  it("forwards no hand-off for a signed-out reader on a public page, forged or not", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const forged = new NextRequest("http://localhost/", {
      headers: { [SESSION_USER_HEADER]: encodeURIComponent(JSON.stringify({ id: "admin" })) },
    });
    const response = await proxy(forged);
    expect(forwarded(response)).toBeNull();
  });
});
