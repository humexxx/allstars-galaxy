"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({
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
        <h2 className="text-xl font-semibold tracking-tight">
          Couldn&apos;t load this page
        </h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading this section. Try again or pick another module from the sidebar.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
