// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminTransactionRow } from "@/types/transaction";

vi.mock("@/app/actions/admin-transactions", () => ({
  approveTransaction: vi.fn(),
  rejectTransaction: vi.fn(),
}));

import { TransactionRow } from "./transaction-row";

const BASE: AdminTransactionRow = {
  id: "t1",
  amount: "500.00",
  fee: "0.00",
  total: "500.00",
  date: new Date("2026-09-30T15:00:00Z"),
  status: "pending",
  type: "withdrawal",
  notes: null,
  user: { id: "u1", email: "alex@example.test", fullName: "Alexander", avatarUrl: null },
  method: { id: "m1", name: "Crypto Momentum" },
  portfolioName: "My Main Portfolio",
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
};

describe("TransactionRow", () => {
  it("names the method — the first thing an approver needs to know", () => {
    render(
      <table>
        <tbody>
          <TransactionRow transaction={BASE} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Crypto Momentum")).toBeInTheDocument();
  });

  it("labels an admin's own entry auto-approved instead of a bare dash", () => {
    // Approved at save time, no approver recorded: a "—" under "Processed by"
    // beside "Approved" read like missing data.
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={{
              ...BASE,
              status: "approved",
              type: "buy",
              approvedAt: new Date("2026-06-18T00:00:00Z"),
            }}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText("Auto-approved")).toBeInTheDocument();
  });

  it("gives a phone labelled approve and reject buttons beside the amount", () => {
    render(
      <ul>
        <TransactionRow transaction={BASE} layout="card" />
      </ul>
    );

    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Approve \$500\.00 withdrawal/ })).toHaveTextContent(
      "Approve"
    );
    expect(screen.getByRole("button", { name: /^Reject \$500\.00 withdrawal/ })).toHaveTextContent(
      "Reject"
    );
  });
});
