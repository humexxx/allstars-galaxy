import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const AUTH_FILE = path.join(__dirname, "..", "playwright", ".auth", "user.json");

setup("authenticate test user", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing TEST_USER_EMAIL / TEST_USER_PASSWORD. Copy .env.test.example to .env.test and fill in a dedicated Supabase test user."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  // Landing on /portal proves the session cookie was set and middleware accepts it.
  await page.waitForURL("**/portal**", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
