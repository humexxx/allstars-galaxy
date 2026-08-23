import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getBaseUrl` decides where a share link points, so it is worth pinning:
 * a link built from the wrong origin is a link the recipient cannot open,
 * and that failure looks like a bug in sharing rather than in configuration.
 */
const ORIGINS = [
  "NEXT_PUBLIC_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

async function baseUrlWith(vars: Partial<Record<(typeof ORIGINS)[number], string>>) {
  vi.resetModules();
  const previous = { ...process.env };
  // Deleted, not assigned `undefined`: Node stores that as the *string*
  // "undefined", which is truthy, so every branch would take the first one.
  for (const key of ORIGINS) delete process.env[key];
  Object.assign(process.env, { SKIP_ENV_VALIDATION: "1" }, vars);
  const { getBaseUrl } = await import("./env");
  const result = getBaseUrl();
  process.env = previous;
  return result;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.resetModules());

describe("getBaseUrl", () => {
  it("falls back to the dev origin when nothing is configured", async () => {
    expect(await baseUrlWith({})).toBe("http://localhost:3010");
  });

  it("prefers the stable production host over the deployment's own", async () => {
    // VERCEL_URL is a new hostname on every push, and on a team project it
    // sits behind Deployment Protection — a share link built from it lands
    // the recipient on a Vercel login page.
    expect(
      await baseUrlWith({
        VERCEL_PROJECT_PRODUCTION_URL: "allstars.vercel.app",
        VERCEL_URL: "allstars-abc123-team.vercel.app",
      })
    ).toBe("https://allstars.vercel.app");
  });

  it("still uses the deployment host when that is all there is", async () => {
    expect(
      await baseUrlWith({ VERCEL_URL: "allstars-abc123-team.vercel.app" })
    ).toBe("https://allstars-abc123-team.vercel.app");
  });

  it("lets an explicit base url win over everything", async () => {
    // The only one that can name a domain Vercel does not know about.
    expect(
      await baseUrlWith({
        NEXT_PUBLIC_BASE_URL: "https://allstars.example.com",
        VERCEL_PROJECT_PRODUCTION_URL: "allstars.vercel.app",
      })
    ).toBe("https://allstars.example.com");
  });
});
