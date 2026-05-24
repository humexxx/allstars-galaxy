import { GalleryVerticalEnd } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Log in | Allstars Galaxy",
  description: "Sign in to your Allstars Galaxy workspace.",
}

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-10">
        <header className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Allstars Galaxy
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs" aria-label="Login form">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
      <aside className="bg-muted relative hidden lg:block" aria-hidden="true">
        <Image
          src="/images/placeholder.svg"
          alt="Decorative background"
          fill
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          sizes="50vw"
        />
      </aside>
    </main>
  )
}
