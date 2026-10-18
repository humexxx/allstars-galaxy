"use client";

import { DataError } from "@/components/portal/data-error";

/**
 * Outside the portal shell there is no chrome to sit in, so this one supplies
 * the full-height page; the copy and the connectivity detection are shared
 * with every route boundary through `DataError`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh flex-col">
      <DataError
        error={error}
        reset={reset}
        title="Something went wrong"
        backHref="/"
        backLabel="Back to home"
      />
    </main>
  );
}
