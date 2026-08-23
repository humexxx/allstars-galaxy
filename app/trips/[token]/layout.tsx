import type { ReactNode } from "react";
import Link from "next/link";
import { GalleryVerticalEnd } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

import { getCurrentUser } from "@/lib/services/auth-server";
import { getPublicTripByToken } from "@/lib/services/travel-service";
import { ShareCta } from "@/components/travel/share-cta";

/**
 * The bar a recipient sees, with the way in on it.
 *
 * Sign in and sign up used to be a card above the trip, which is a lot of
 * furniture in front of the thing somebody was sent to look at. On the bar
 * they are available without being the first thing read.
 *
 * This layout exists rather than the parent one because the invitation is
 * token-specific — the sign-up prefills the email the link was labelled with,
 * and returns the reader here afterwards. `getPublicTripByToken` is
 * `React.cache`d, so sharing it with the page costs nothing.
 */
export default async function PublicTripLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [view, currentUser] = await Promise.all([
    getPublicTripByToken(token),
    getCurrentUser(),
  ]);

  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-medium">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEnd className="size-3.5" />
            </span>
            <span className="hidden sm:inline">Allstars Galaxy</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <ShareCta
              inviteeEmail={view?.share.inviteeEmail ?? null}
              currentUserEmail={currentUser?.email ?? null}
              shareToken={token}
            />
            <ModeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
