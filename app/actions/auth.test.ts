import { afterEach, describe, expect, it, vi } from "vitest";

// Next.js `redirect()` throws a control-flow error in real usage; emulate it so
// the action hands control back to the test through a rejection.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const cookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    delete: (...args: unknown[]) => cookieDelete(...args),
  }),
}));

const signOut = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({ auth: { signOut } }),
}));

vi.mock("@/lib/services/impersonation", () => ({
  IMPERSONATION_COOKIE: "cg_impersonating",
}));

import { signOutAction } from "./auth";

afterEach(() => {
  vi.clearAllMocks();
});

describe("signOutAction", () => {
  it("ends the session for this browser only and redirects to /login", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("clears the impersonation cookie, so the next admin sign-in does not resume impersonating", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(cookieDelete).toHaveBeenCalledWith("cg_impersonating");
  });
});
