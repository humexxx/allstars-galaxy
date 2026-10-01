import Link from "next/link"

import { AuthAside } from "@/components/auth-aside"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { Logo } from "@/components/logo"
import { UpdatePasswordForm } from "@/components/update-password-form"
import { createClient } from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
}

export default async function UpdatePasswordPage() {
  // The reset link signs the user in before landing here; without a session
  // there is no account to set a password on, so send them to ask again.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/forgot-password")

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
            <UpdatePasswordForm />
          </div>
        </div>
      </section>
      <AuthAside />
    </main>
  )
}
