"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BASE_PATH = "/portal/admin/transactions";

export function TransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userId = searchParams.get("userId") ?? "";
  const status = searchParams.get("status") ?? "pending";
  const type = searchParams.get("type") ?? "all";

  const setParam = (key: "userId" | "status" | "type", value: string) => {
    const next = new URLSearchParams(searchParams.toString());
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
      className={`mb-6 flex flex-col items-end gap-4 sm:flex-row ${
        isPending ? "opacity-90" : "opacity-100"
      }`}
    >
      <div className="flex w-full flex-col gap-2 sm:w-72">
        <Label htmlFor="filter-user-id">User ID</Label>
        <Input
          id="filter-user-id"
          placeholder="Filter by User ID..."
          defaultValue={userId}
          onChange={(e) => setParam("userId", e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-50">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) => setParam("status", value)}
          disabled={isPending}
        >
          <SelectTrigger id="filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-50">
        <Label htmlFor="filter-type">Type</Label>
        <Select
          value={type}
          onValueChange={(value) => setParam("type", value)}
          disabled={isPending}
        >
          <SelectTrigger id="filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
