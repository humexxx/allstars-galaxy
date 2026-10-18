"use client";

import { DataError } from "@/components/portal/data-error";

export default function AdminError({
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
      title="Couldn't load Admin"
      backHref="/portal/admin/users"
      backLabel="Back to Admin"
    />
  );
}
