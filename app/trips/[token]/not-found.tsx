import Link from "next/link";
import { Link2Off } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";

export default function PublicTripNotFound() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="rounded-full bg-muted p-3 text-muted-foreground">
          <Link2Off className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <Heading level="h4" as="h1">
            This share link is no longer available
          </Heading>
          <Text variant="muted">
            The owner may have revoked it, or it has expired. Ask them for a fresh link.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Plan your own trip</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
