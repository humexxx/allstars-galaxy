"use client";

import { DataError } from "@/components/portal/data-error";

export default function PlansError({
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
      title="Couldn't load Plans"
      backHref="/portal/plans"
      backLabel="Back to Plans"
    />
  );
}
