import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";

/**
 * The bar around a shared article.
 *
 * Public and unauthenticated on purpose: the point of the page is that a link
 * to it works for anybody. Same furniture as a shared trip — the way back into
 * the app is available without being the first thing read.
 */
export default function F1NewsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-medium">
            <Logo className="size-6" />
            <span className="hidden sm:inline">Allstars Galaxy</span>
          </Link>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mt-auto border-t py-6 text-center text-xs text-muted-foreground">
        Shared via{" "}
        <Link href="/" className="font-medium hover:text-foreground">
          Allstars Galaxy
        </Link>
      </footer>
    </div>
  );
}
