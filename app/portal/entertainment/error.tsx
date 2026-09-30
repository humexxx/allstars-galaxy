"use client";

import { DataError } from "@/components/portal/data-error";

export default function EntertainmentError({
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
      title="Couldn't load Entertainment"
      backHref="/portal/entertainment/sports"
      backLabel="Back to Entertainment"
    />
  );
}
