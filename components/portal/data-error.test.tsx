// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataError } from "./data-error";

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

function renderError(message: string) {
  return render(
    <DataError
      error={Object.assign(new Error(message), { digest: "abc123" })}
      reset={vi.fn()}
      title="Couldn't load Portfolio"
      backHref="/portal"
      backLabel="Back to dashboard"
    />
  );
}

describe("DataError", () => {
  it("names a DNS failure as connectivity rather than a bug", () => {
    renderError("getaddrinfo ENOTFOUND aws-1-us-east-2.pooler.supabase.com");

    expect(screen.getByText(/couldn't reach the database/i)).toBeInTheDocument();
    expect(screen.getByText(/the app is fine/i)).toBeInTheDocument();
  });

  it("recognises a wrapped Drizzle query failure", () => {
    // This is the shape the user actually sees: Drizzle swallows the cause and
    // reports only "Failed query: …".
    renderError('Failed query: select "role" from "users" where "users"."id" = $1');

    expect(screen.getByText(/couldn't reach the database/i)).toBeInTheDocument();
  });

  it("points at the diagnostic when connectivity is the problem", () => {
    renderError("fetch failed");

    expect(screen.getByText(/diagnose-dns\.sh/)).toBeInTheDocument();
  });

  it("keeps the generic message for a real bug", () => {
    renderError("Cannot read properties of undefined (reading 'map')");

    expect(screen.getByText(/couldn't load portfolio/i)).toBeInTheDocument();
    expect(screen.queryByText(/the app is fine/i)).not.toBeInTheDocument();
  });

  it("always surfaces the digest so a production report can be traced", () => {
    renderError("boom");

    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});
