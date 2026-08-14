"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";

export default function ProductivityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div className="space-y-2">
        <Heading level="h3" as="h2">
          Couldn&apos;t load Productivity
        </Heading>
        <Text variant="muted">
          Something went wrong while loading this section. Try again or go back to the Productivity overview.
        </Text>
        {error.digest && (
          <Text variant="muted" className="text-xs">Reference: {error.digest}</Text>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/portal/productivity">Back to Productivity</Link>
        </Button>
      </div>
    </section>
  );
}
