import Link from "next/link";
import { CalendarX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SPORTS_PATH } from "@/lib/sports/paths";

/** A tournament or race the season does not have: an old link, a mistyped one. */
export default function SportsNotFound(): React.ReactElement {
  return (
    <EmptyState
      variant="card"
      titleAs="h1"
      icon={CalendarX}
      title="Not on this season's calendar"
      description="This tournament or race isn't one the feed lists this season."
      action={
        <Button asChild>
          <Link href={SPORTS_PATH}>Back to Sports</Link>
        </Button>
      }
    />
  );
}
