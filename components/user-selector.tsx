"use client";

import * as React from "react";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type User = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type UserSelectorProps = {
  /** Set on the trigger so a `<label htmlFor>` names it. */
  id?: string;
  users: User[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Label of a first entry that clears the selection (value ""), for use as
   *  a filter — e.g. "All users". Omitted, a choice cannot be undone. */
  clearLabel?: string;
};

export function UserSelector({
  id,
  users,
  value,
  onValueChange,
  placeholder = "Select user…",
  disabled = false,
  className,
  clearLabel,
}: UserSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const selectedUser = users.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex min-w-0 items-center gap-2">
            <UserIcon className="text-muted-foreground" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {selectedUser
                ? selectedUser.fullName || selectedUser.email
                : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Never wider than the space Radix measured: `min-w-80` alone ran past a phone's
          gutter when the trigger sat in a narrow column. */}
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 max-w-(--radix-popover-content-available-width) p-0">
        <Command>
          <CommandInput placeholder="Search users…" />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
                <CommandItem
                  value="__all__"
                  keywords={[clearLabel]}
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === "" ? "opacity-100" : "opacity-0")} />
                  {clearLabel}
                </CommandItem>
              )}
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  keywords={[
                    user.id,
                    user.fullName || "",
                    user.email || "",
                  ]}
                  onSelect={() => {
                    onValueChange(user.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      value === user.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{user.fullName || user.email}</span>
                    {user.fullName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
