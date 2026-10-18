"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BASE_PATH = "/portal/admin/transactions";

export function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userId = searchParams.get("userId") ?? "";
  // Local text state, pushed to the URL after a pause. Pushing every keystroke
  // disabled the input mid-word (it was `disabled={isPending}`) and the rest
  // of the typing went nowhere.
  const [userIdText, setUserIdText] = useState(userId);
  // Back/forward changes the URL without remounting; follow it.
  const [prevUserId, setPrevUserId] = useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    setUserIdText(userId);
  }
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);
  const status = searchParams.get("status") ?? "pending";
  const type = searchParams.get("type") ?? "all";

  const setParam = (key: "userId" | "status" | "type", value: string): void => {
    // Read the live URL, not the render's `searchParams`: the debounced user-id
    // push runs 300ms later and would otherwise undo a status change made in
    // between.
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
    <div
      aria-busy={isPending}
      className={cn(
        "flex flex-col items-end gap-4 sm:flex-row",
        isPending ? "opacity-90" : "opacity-100"
      )}
    >
      <Field className="w-full sm:w-72">
        <FieldLabel htmlFor="filter-user-id">User ID</FieldLabel>
        <Input
          id="filter-user-id"
          placeholder="Filter by user ID…"
          value={userIdText}
          onChange={(e) => {
            const value = e.target.value;
            setUserIdText(value);
            if (debounce.current) clearTimeout(debounce.current);
            debounce.current = setTimeout(() => setParam("userId", value.trim()), 300);
          }}
        />
      </Field>

      {/* Not `disabled` while the navigation runs: disabling the focused
          control drops keyboard focus to the page. */}
      <Field className="w-full sm:w-50">
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

      <Field className="w-full sm:w-50">
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
