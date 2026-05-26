import { z } from "zod"

import type { Env } from "@/types/env"

/**
 * Runtime env validation. Fails fast at first import if a required variable
 * is missing or malformed, instead of producing cryptic Supabase / Drizzle
 * errors deep inside a request. Optional fields stay optional.
 *
 * Skipped when `SKIP_ENV_VALIDATION=1` so build steps that don't need the
 * runtime env (e.g. `next build` in CI before secrets are wired) can still
 * succeed.
 */
const envSchema = z.object({
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16).optional(),
  VERCEL_API_TOKEN: z.string().min(1).optional(),
})

function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return {
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
      VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN,
    }
  }

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN,
  })

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors
    const summary = Object.entries(flat)
      .map(([key, errors]) => `  - ${key}: ${(errors ?? []).join(", ")}`)
      .join("\n")
    throw new Error(
      `Invalid environment variables. Check your .env file:\n${summary}`,
    )
  }

  return parsed.data
}

export const env: Env = loadEnv()

export function getBaseUrl(): string {
  if (env.NEXT_PUBLIC_BASE_URL) {
    return env.NEXT_PUBLIC_BASE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3010"
}
