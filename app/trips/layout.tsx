import Link from "next/link";
import { GalleryVerticalEnd } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

export default function PublicTripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-3.5" />
            </span>
            Allstars Galaxy
          </Link>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Shared via{" "}
        <Link href="/" className="font-medium hover:text-foreground">
          Allstars Galaxy
        </Link>
      </footer>
    </div>
  );
}
