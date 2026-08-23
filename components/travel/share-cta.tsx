import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";

type ShareCtaProps = {
  /** Email recorded with the share link (used to prefill signup). */
  inviteeEmail: string | null;
  /** Email of the currently signed-in user, or null when anonymous. */
  currentUserEmail: string | null;
  /** Token from the URL; we pass it back through ?next= so post-login lands here. */
  shareToken: string;
};

/**
 * The way in, on the bar rather than in front of the trip.
 *
 * It used to be a card above the itinerary — a paragraph, an icon and two
 * buttons standing between somebody and the thing they were sent to look at.
 * Whoever shared the link wanted the trip read, not the product pitched.
 */
export function ShareCta({ inviteeEmail, currentUserEmail, shareToken }: ShareCtaProps) {
  const nextPath = `/trips/${shareToken}`;

  // Signed in already → no signup nudge. Quietly point them at their planner.
  if (currentUserEmail) {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link href="/portal/entertainment/travel-planner">
          My trips <ArrowRight className="ml-1 size-3.5" />
        </Link>
      </Button>
    );
  }

  const signupHref = inviteeEmail
    ? `/signup?email=${encodeURIComponent(inviteeEmail)}&next=${encodeURIComponent(nextPath)}`
    : `/signup?next=${encodeURIComponent(nextPath)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex items-center gap-1">
      {/* The label the link was created with, so signing up does not ask for
          an address the sender already knew. Hidden on a phone, where the bar
          has room for the buttons and nothing else. */}
      {inviteeEmail && (
        <Text variant="small" className="mr-2 hidden truncate sm:block">
          Invited as{" "}
          <Text as="span" weight="medium" className="text-foreground">
            {inviteeEmail}
          </Text>
        </Text>
      )}
      <Button asChild size="sm" variant="ghost">
        <Link href={loginHref}>Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href={signupHref}>
          {inviteeEmail ? "Continue" : "Sign up"}
          <ArrowRight className="ml-1 size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
