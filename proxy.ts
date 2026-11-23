import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { encodeSessionUser, SESSION_USER_HEADER } from "@/lib/auth/session-header"

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Only the proxy may say who is signed in: a copy the browser sent is dropped.
  request.headers.delete(SESSION_USER_HEADER)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims refreshes an expired session like getUser, and checks the token
  // against the project's public key without a round trip once Supabase signs
  // with an asymmetric key; with the legacy shared secret it still asks
  // Supabase, as getUser did.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const user = claims?.sub
    ? { id: claims.sub, email: claims.email, user_metadata: claims.user_metadata ?? {} }
    : null

  const { pathname } = request.nextUrl
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/")
  if (isPortal && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if ((pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") && user) {
    return NextResponse.redirect(new URL("/portal", request.url))
  }

  if (!user) return response

  // Handed on with the request, so the page's own server code does not ask again.
  request.headers.set(SESSION_USER_HEADER, encodeSessionUser(user))
  const next = NextResponse.next({ request: { headers: request.headers } })
  response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie))
  return next
}

export const config = {
  matcher: [
    // Every route but Next's own assets and the files in /public. Never skip
    // by extension: a dynamic route answers "/portal/plans/x.png" too, and a
    // request the proxy skips would keep a session header the browser forged.
    '/((?!_next/static|_next/image|favicon\\.ico|favicon-(?:dark|light)\\.svg|images/|f1/teams/).*)',
  ],
}
