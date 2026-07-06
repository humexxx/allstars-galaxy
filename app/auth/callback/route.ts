import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const next = requestUrl.searchParams.get("next") || "/portal"

  const loginWithError = (message: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    )

  // The provider (or Supabase) reports failures via error params instead of a
  // code — surface them on the login page rather than bouncing silently.
  const providerError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error")
  if (providerError) {
    return loginWithError(providerError)
  }
  if (!code) {
    return loginWithError("Sign-in was cancelled or the link is invalid.")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return loginWithError(error.message)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
