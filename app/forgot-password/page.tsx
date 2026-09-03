import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request a password reset for your Allstars Galaxy account.",
}

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-12">
        <header className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Logo className="size-6" />
            Allstars Galaxy
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <ForgotPasswordForm />
          </div>
        </div>
      </section>
      <aside className="bg-muted relative hidden lg:block" aria-hidden="true">
        <Image
          src="/images/placeholder.svg"
          alt=""
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          sizes="50vw"
        />
      </aside>
    </main>
  )
}
