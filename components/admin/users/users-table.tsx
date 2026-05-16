"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";

import { startImpersonationAction } from "@/app/actions/impersonation";
import { updateUserRoleAction } from "@/app/actions/admin-users";

import type { UserListItem } from "@/types";

// Pre-build the row action set so the UI stays declarative
// and the user's selected behaviour (Impersonate + role toggle) is the only surface.

type UsersTableProps = {
  users: UserListItem[];
  currentAdminId: string;
};

type PendingRoleChange = {
  user: UserListItem;
  nextRole: "admin" | "user";
};

export function UsersTable({ users, currentAdminId }: UsersTableProps) {
  const [query, setQuery] = useState("");
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [isRolePending, startRoleTransition] = useTransition();

  const sortedUsers = useMemo(() => {
    // Pin the current admin to the top so it is always immediately visible.
    return [...users].sort((a, b) => {
      if (a.id === currentAdminId) return -1;
      if (b.id === currentAdminId) return 1;
      return 0;
    });
  }, [users, currentAdminId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter((u) => {
      const name = (u.fullName ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || u.id.toLowerCase().includes(q);
    });
  }, [sortedUsers, query]);

  const confirmRoleChange = () => {
    if (!pendingRoleChange) return;
    const { user, nextRole } = pendingRoleChange;
    startRoleTransition(async () => {
      const result = await updateUserRoleAction({ userId: user.id, role: nextRole });
      if (result.success) {
        toast.success(`${user.fullName ?? user.email ?? "User"} is now ${nextRole}`);
        setPendingRoleChange(null);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by name, email or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Filter users"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query ? "No users match your filter" : "No users yet"}
          description={query ? "Try a different query." : undefined}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="w-[120px]">Role</TableHead>
                <TableHead className="w-[60px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => {
                const isSelf = user.id === currentAdminId;
                const isAdmin = user.role === "admin";
                const displayName = user.fullName || user.email || "Unknown";
                const initial = (user.fullName || user.email || "?").charAt(0).toUpperCase();
                const nextRole: "admin" | "user" = isAdmin ? "user" : "admin";

                return (
                  <TableRow key={user.id} className={isSelf ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl ?? ""} alt={displayName} />
                          <AvatarFallback>{initial}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayName}</span>
                            {isSelf && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          {user.email && (
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Badge variant="default" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf ? (
                        // No actions on yourself: keeps the UI honest and avoids a
                        // dropdown with everything greyed out.
                        <span className="text-xs text-muted-foreground" aria-label="No actions available">
                          —
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${displayName}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {!isAdmin ? (
                              <form action={startImpersonationAction}>
                                <input type="hidden" name="userId" value={user.id} />
                                <DropdownMenuItem asChild>
                                  <button
                                    type="submit"
                                    className="w-full cursor-pointer text-left"
                                  >
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Impersonate
                                  </button>
                                </DropdownMenuItem>
                              </form>
                            ) : (
                              <DropdownMenuItem disabled>
                                <UserCog className="mr-2 h-4 w-4" />
                                Impersonate
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setPendingRoleChange({ user, nextRole });
                              }}
                            >
                              {isAdmin ? (
                                <>
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Demote to user
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Promote to admin
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRoleChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRoleChange?.nextRole === "admin"
                ? "Promote to admin?"
                : "Demote to user?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange?.nextRole === "admin" ? (
                <>
                  <strong>{pendingRoleChange?.user.fullName ?? pendingRoleChange?.user.email}</strong>{" "}
                  will gain full admin access — including the ability to approve transactions and
                  impersonate other users.
                </>
              ) : (
                <>
                  <strong>{pendingRoleChange?.user.fullName ?? pendingRoleChange?.user.email}</strong>{" "}
                  will lose admin access immediately.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRolePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={isRolePending}>
              {isRolePending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
