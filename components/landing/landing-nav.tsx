"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#modules", label: "Modules" },
  { href: "#how", label: "How it works" },
  { href: "#galaxy", label: "Why Galaxy" },
];

export function LandingNav(): React.ReactElement {
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent bg-background/0 transition-all",
        scrolled && "border-border/60 bg-background/85 backdrop-blur"
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span
            className="grid size-8 place-items-center rounded-md bg-foreground text-background"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
              <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
              <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
            </svg>
          </span>
          <span className="text-lg tracking-tight">Capital Galaxy</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-full hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
