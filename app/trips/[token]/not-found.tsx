import Link from "next/link";
import { Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { signupsAllowed } from "@/lib/auth/signups";

export default function PublicTripNotFound() {
  // While signups are closed there is no trip of their own to start. Signing
  // in is already on the layout's bar above this, so home is the one way on.
  const signupsOpen = signupsAllowed();

  return (
    <EmptyState
      variant="card"
      titleAs="h1"
      icon={Link2Off}
      title="This share link is no longer available"
      description="The owner may have revoked it, or it has expired. Ask them for a fresh link."
      action={
        <>
          {signupsOpen && (
            <Button asChild>
              <Link href="/signup">Plan your own trip</Link>
            </Button>
          )}
          <Button asChild variant={signupsOpen ? "outline" : "default"}>
            <Link href="/">Back to home</Link>
          </Button>
        </>
      }
    />
  );
}
