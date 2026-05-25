// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above top-level declarations, so the mock factory
// can't reference module-scope variables directly. `vi.hoisted` lifts the
// mock state alongside the mock factory so both share the same lexical
// position after hoisting.
const { supabaseAuthMock, createClientMock } = vi.hoisted(() => {
  const auth = {
    signInWithOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  };
  return {
    supabaseAuthMock: auth,
    createClientMock: vi.fn(() => ({ auth })),
  };
});

vi.mock("@/lib/supabase", () => ({
  createClient: createClientMock,
}));

import { AuthService, signOut } from "./auth-service";

beforeEach(() => {
  createClientMock.mockClear();
  for (const fn of Object.values(supabaseAuthMock)) {
    fn.mockReset();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthService.signInWithEmail", () => {
  it("resolves when supabase returns no error and forwards the callback redirect", async () => {
    supabaseAuthMock.signInWithOtp.mockResolvedValueOnce({ error: null });

    await expect(AuthService.signInWithEmail("user@example.com")).resolves.toBeUndefined();
    expect(supabaseAuthMock.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("otp failed");
    supabaseAuthMock.signInWithOtp.mockResolvedValueOnce({ error });

    await expect(AuthService.signInWithEmail("user@example.com")).rejects.toBe(error);
  });
});

describe("AuthService.signInWithGoogle", () => {
  it("builds the callback URL without a next query when none is provided", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({ error: null });

    await AuthService.signInWithGoogle();

    expect(supabaseAuthMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  });

  it("appends a URL-encoded next query param when provided", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({ error: null });

    await AuthService.signInWithGoogle("/portal/dashboard?tab=overview");

    expect(supabaseAuthMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(
          "/portal/dashboard?tab=overview"
        )}`,
      },
    });
  });

  it("treats a null next as no query param", async () => {
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({ error: null });

    await AuthService.signInWithGoogle(null);

    expect(supabaseAuthMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("oauth blocked");
    supabaseAuthMock.signInWithOAuth.mockResolvedValueOnce({ error });

    await expect(AuthService.signInWithGoogle()).rejects.toBe(error);
  });
});

describe("AuthService.loginWithPassword", () => {
  it("returns supabase data on success", async () => {
    const data = { user: { id: "u-1" }, session: { access_token: "tok" } };
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({ data, error: null });

    const result = await AuthService.loginWithPassword("user@example.com", "hunter2");

    expect(result).toBe(data);
    expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "hunter2",
    });
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("bad credentials");
    supabaseAuthMock.signInWithPassword.mockResolvedValueOnce({ data: null, error });

    await expect(
      AuthService.loginWithPassword("user@example.com", "wrong")
    ).rejects.toBe(error);
  });
});

describe("AuthService.signUpWithEmail", () => {
  it("returns supabase data and forwards the email redirect without next", async () => {
    const data = { user: { id: "u-1" }, session: null };
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data, error: null });

    const result = await AuthService.signUpWithEmail(
      "user@example.com",
      "hunter2",
      "Alice"
    );

    expect(result).toBe(data);
    expect(supabaseAuthMock.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "hunter2",
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: { full_name: "Alice" },
      },
    });
  });

  it("appends URL-encoded next when provided", async () => {
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data: {}, error: null });

    await AuthService.signUpWithEmail(
      "user@example.com",
      "hunter2",
      "Alice",
      "/portal/welcome"
    );

    expect(supabaseAuthMock.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(
            "/portal/welcome"
          )}`,
        }),
      })
    );
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("email taken");
    supabaseAuthMock.signUp.mockResolvedValueOnce({ data: null, error });

    await expect(
      AuthService.signUpWithEmail("user@example.com", "hunter2", "Alice")
    ).rejects.toBe(error);
  });
});

describe("AuthService.signOut", () => {
  it("resolves when supabase returns no error", async () => {
    supabaseAuthMock.signOut.mockResolvedValueOnce({ error: null });

    await expect(AuthService.signOut()).resolves.toBeUndefined();
    expect(supabaseAuthMock.signOut).toHaveBeenCalledTimes(1);
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("signout failed");
    supabaseAuthMock.signOut.mockResolvedValueOnce({ error });

    await expect(AuthService.signOut()).rejects.toBe(error);
  });
});

describe("AuthService.resetPasswordForEmail", () => {
  it("passes redirectTo pointing at the update-password callback", async () => {
    supabaseAuthMock.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

    await AuthService.resetPasswordForEmail("user@example.com");

    expect(supabaseAuthMock.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      {
        redirectTo: `${location.origin}/auth/callback?next=/portal/profile/update-password`,
      }
    );
  });

  it("rethrows the supabase error", async () => {
    const error = new Error("reset failed");
    supabaseAuthMock.resetPasswordForEmail.mockResolvedValueOnce({ error });

    await expect(AuthService.resetPasswordForEmail("user@example.com")).rejects.toBe(
      error
    );
  });
});

describe("signOut helper", () => {
  it("invokes supabase signOut and swallows the result", async () => {
    supabaseAuthMock.signOut.mockResolvedValueOnce({ error: null });

    await expect(signOut()).resolves.toBeUndefined();
    expect(supabaseAuthMock.signOut).toHaveBeenCalledTimes(1);
  });
});
