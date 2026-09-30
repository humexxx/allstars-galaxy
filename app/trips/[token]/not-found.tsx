import Link from "next/link";
import { Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function PublicTripNotFound() {
  return (
    <EmptyState
      variant="card"
      titleAs="h1"
      icon={Link2Off}
      title="This share link is no longer available"
      description="The owner may have revoked it, or it has expired. Ask them for a fresh link."
      action={
        <>
          <Button asChild>
            <Link href="/signup">Plan your own trip</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </>
      }
    />
  );
}
