import Link from "next/link"

import { AuthAside } from "@/components/auth-aside"
import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/login-form"
import { signupsAllowed } from "@/lib/auth/signups"
import { FormSkeleton } from "@/components/skeletons/form-skeleton"
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your Allstars Galaxy workspace.",
}

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-12">
        <header className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Logo className="size-6" decorative />
            Allstars Galaxy
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Suspense fallback={<FormSkeleton rows={2} />}>
              <LoginForm signupsOpen={signupsAllowed()} />
            </Suspense>
          </div>
        </div>
      </section>
      <AuthAside />
    </main>
  )
}
