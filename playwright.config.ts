import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// `.env` carries DATABASE_URL (used by the cleanFavorites fixture to reset
// per-test state). `.env.test` carries TEST_USER_EMAIL / TEST_USER_PASSWORD.
// `.env.test` is gitignored — see `.env.test.example` for the template.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.test", override: true });

const PORT = Number(process.env.E2E_PORT ?? 3010);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Single-worker because all specs share one Supabase user and we mutate the
  // user_sports_preferences table per test. Parallel runs would race.
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Reuse the developer's running `npm run dev` on :3010. Next 16 refuses to
  // start a second dev server in the same project directory, so spinning one
  // up here would fight that lock.
  webServer: process.env.CI
    ? {
        command: "npm run dev",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: false,
      }
    : undefined,
});
