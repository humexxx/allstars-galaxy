import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ShareCtaProps = {
  /** Email recorded with the share link (used to prefill signup). */
  inviteeEmail: string | null;
  /** Email of the currently signed-in user, or null when anonymous. */
  currentUserEmail: string | null;
  /** Token from the URL; we pass it back through ?next= so post-login lands here. */
  shareToken: string;
};

export function ShareCta({ inviteeEmail, currentUserEmail, shareToken }: ShareCtaProps) {
  const nextPath = `/trips/${shareToken}`;

  // Signed in already → no signup nudge. Quietly point them to their planner.
  if (currentUserEmail) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <p className="text-sm">
            You&apos;re signed in as <span className="font-medium">{currentUserEmail}</span>. Plan
            your own trip in the portal.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/portal/entertainment/travel-planner">
              Open my trips <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const signupHref = inviteeEmail
    ? `/signup?email=${encodeURIComponent(inviteeEmail)}&next=${encodeURIComponent(nextPath)}`
    : `/signup?next=${encodeURIComponent(nextPath)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Plan your own trip with Allstars Galaxy</p>
            <p className="text-xs text-muted-foreground">
              {inviteeEmail ? (
                <>
                  Create an account as{" "}
                  <span className="font-medium text-foreground">{inviteeEmail}</span> or continue
                  with a social provider.
                </>
              ) : (
                <>Create an account in seconds — free for personal use.</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link href={loginHref}>Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={signupHref}>
              {inviteeEmail ? "Continue" : "Sign up"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
