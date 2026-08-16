"use client";

import { DataError } from "@/components/portal/data-error";

export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DataError
      error={error}
      reset={reset}
      title="Couldn't load Portfolio"
      backHref="/portal"
      backLabel="Back to dashboard"
    />
  );
}
