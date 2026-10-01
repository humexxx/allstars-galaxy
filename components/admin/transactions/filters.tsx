"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { UserSelector } from "@/components/user-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BASE_PATH = "/portal/admin/transactions";

type FilterUser = { id: string; fullName: string | null; email: string | null };

/**
 * The queue's filters, kept in the URL so a filtered view can be shared.
 *
 * The user filter is a searchable picker by name or email. It was a free-text
 * "User ID" box: to use it an admin had to go and copy a UUID from somewhere
 * else, which nobody does.
 */
export function TransactionFilters({ users }: { users: FilterUser[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userId = searchParams.get("userId") ?? "";
  const status = searchParams.get("status") ?? "pending";
  const type = searchParams.get("type") ?? "all";

  const setParam = (key: "userId" | "status" | "type", value: string): void => {
    // Read the live URL, not the render's `searchParams`, so two changes made
    // in quick succession both survive.
    const next = new URLSearchParams(window.location.search);
    if (!value || (key !== "status" && value === "all")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${BASE_PATH}?${query}` : BASE_PATH);
    });
  };

  return (
    // Two columns on a phone for the two short selects: stacked one per row,
    // three full-width fields pushed the queue itself below the fold.
    <div
      aria-busy={isPending}
      className={cn(
        "grid grid-cols-2 items-end gap-4 sm:flex sm:flex-row",
        isPending ? "opacity-90" : "opacity-100"
      )}
    >
      <Field className="col-span-2 sm:w-72">
        <FieldLabel htmlFor="filter-user">User</FieldLabel>
        <UserSelector
          id="filter-user"
          users={users}
          value={userId}
          onValueChange={(value) => setParam("userId", value)}
          placeholder="All users"
          clearLabel="All users"
        />
      </Field>

      {/* Not `disabled` while the navigation runs: disabling the focused
          control drops keyboard focus to the page. */}
      <Field className="min-w-0 sm:w-50">
        <FieldLabel htmlFor="filter-status">Status</FieldLabel>
        <Select value={status} onValueChange={(value) => setParam("status", value)}>
          <SelectTrigger id="filter-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field className="min-w-0 sm:w-50">
        <FieldLabel htmlFor="filter-type">Type</FieldLabel>
        <Select value={type} onValueChange={(value) => setParam("type", value)}>
          <SelectTrigger id="filter-type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
