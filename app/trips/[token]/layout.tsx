import type { ReactNode } from "react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";

import { getCurrentUser } from "@/lib/services/auth-server";
import { getPublicTripByToken } from "@/lib/services/travel-service";
import { ShareCta } from "@/components/travel/share-cta";
import { Logo } from "@/components/logo";

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
            <Logo className="size-6" />
            <span className="hidden sm:inline">Allstars Galaxy</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {/* Theme first, then the way in. The buttons that take somebody
                somewhere belong at the end of the bar, where the eye stops. */}
            <ModeToggle />
            <ShareCta
              inviteeEmail={view?.share.inviteeEmail ?? null}
              currentUserEmail={currentUser?.email ?? null}
              shareToken={token}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
