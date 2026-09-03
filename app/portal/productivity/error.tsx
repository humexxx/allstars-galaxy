"use client";

import { DataError } from "@/components/portal/data-error";

export default function ProductivityError({
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
      title="Couldn't load Productivity"
      backHref="/portal/productivity/board"
      backLabel="Back to Productivity"
    />
  );
}
