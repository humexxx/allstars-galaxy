"use client";

import { DataError } from "@/components/portal/data-error";
import { PortalPageContainer } from "@/components/portal/page-container";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Pages own their container, so the boundary that replaces them does too.
  return (
    <PortalPageContainer>
      <DataError
        error={error}
        reset={reset}
        title="Couldn't load this page"
        backHref="/portal"
        backLabel="Back to dashboard"
      />
    </PortalPageContainer>
  );
}
