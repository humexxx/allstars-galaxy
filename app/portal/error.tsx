"use client";

import { DataError } from "@/components/portal/data-error";

export default function PortalError({
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
      title="Couldn't load this page"
      backHref="/portal"
      backLabel="Back to dashboard"
    />
  );
}
