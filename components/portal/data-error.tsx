"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PlugZap, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Code, Heading, Text } from "@/components/ui/typography";

/**
 * A failed query and a broken app look identical to the user, and they are not
 * the same problem at all. `ENOTFOUND` on the database host means name
 * resolution died — the page is fine, the machine could not find the server.
 *
 * Telling the two apart matters because the fixes are unrelated: one is "try
 * again in a moment", the other is a real bug. Naming it also stops the reader
 * hunting for a mistake in code that has none.
 */
function isConnectivityError(error: Error): boolean {
  const text = `${error.message} ${error.stack ?? ""}`;
  return /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|Failed query/i.test(
    text
  );
}

export function DataError({
  error,
  reset,
  title,
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  backHref: string;
  backLabel: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = isConnectivityError(error);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      {offline && <PlugZap className="size-8 text-muted-foreground" aria-hidden />}

      <div className="max-w-md space-y-2">
        <Heading level="h3" as="h2">
          {offline ? "Couldn't reach the database" : title}
        </Heading>

        {offline ? (
          <>
            <Text variant="muted">
              The app is fine — your machine could not resolve the database host. It
              is usually a passing network hiccup; try again in a moment.
            </Text>
            <Text variant="muted" className="text-xs">
              If it keeps happening, run{" "}
              <Code>sh ~/.claude/scripts/diagnose-dns.sh</Code> to see which layer is
              failing.
            </Text>
          </>
        ) : (
          <Text variant="muted">
            Something went wrong while loading this section. Try again, or go back.
          </Text>
        )}

        {error.digest && (
          <Text variant="muted" className="text-xs">
            Reference: {error.digest}
          </Text>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
