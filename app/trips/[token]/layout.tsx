import type { ReactNode } from "react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { PortalPageContainer } from "@/components/portal/page-container";

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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-medium">
            <Logo className="size-6" decorative />
            {/* The mark is decorative wherever the name is written beside it;
                on a phone, where the name is hidden, the link needs its own. */}
            <span className="sr-only sm:not-sr-only">Allstars Galaxy</span>
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
      {/* The portal's own container, so a shared trip sits in the same gutters
          as the planner it mirrors (and the banner's phone bleed, which
          cancels exactly those 16px, lines up). */}
      <main className="flex flex-1 flex-col">
        <PortalPageContainer>{children}</PortalPageContainer>
      </main>
    </>
  );
}
