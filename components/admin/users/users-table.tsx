"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Briefcase,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Spinner } from "@/components/ui/spinner";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { runAction } from "@/lib/actions/run";

import { startImpersonationAction } from "@/app/actions/impersonation";
import { updateUserRoleAction } from "@/app/actions/admin-users";

import { USER_ROLES, type UserListItem, type UserRole } from "@/types";

// One entry per role, in the order the menu lists them. The role answers a
// single question — may this account create investment methods — so the
// labels say that rather than restating the enum.
const ROLE_META: Record<UserRole, { label: string; hint: string; icon: typeof UserRound }> = {
  admin: { label: "Admin", hint: "Everything, plus impersonation", icon: ShieldCheck },
  provider: { label: "Provider", hint: "Can run investment methods", icon: Briefcase },
  user: { label: "User", hint: "Invests through providers", icon: UserRound },
};

type UsersTableProps = {
  users: UserListItem[];
  currentAdminId: string;
};

type PendingRoleChange = {
  user: UserListItem;
  nextRole: UserRole;
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

  const confirmRoleChange = (): void => {
    if (!pendingRoleChange) return;
    const { user, nextRole } = pendingRoleChange;
    startRoleTransition(async () => {
      const result = await runAction(
        updateUserRoleAction({ userId: user.id, role: nextRole }),
        {
          success: `${user.fullName ?? user.email ?? "User"} is now ${ROLE_META[nextRole].label.toLowerCase()}`,
          failure: "Failed to update role",
        }
      );
      if (result.ok) setPendingRoleChange(null);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <InputGroup className="max-w-sm">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Filter by name, email or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter users"
        />
      </InputGroup>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query ? "No users match your filter" : "No users yet"}
          description={query ? "Try a different query." : undefined}
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  {/* On a phone the role rides under the name: as its own
                      column it pushed Actions off-screen behind a sideways
                      scroll, beside a long email. */}
                  <TableHead className="hidden w-30 sm:table-cell">Role</TableHead>
                  <TableHead className="w-16 text-right">
                    <span className="sr-only sm:not-sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const isSelf = user.id === currentAdminId;
                  const role: UserRole = user.role ?? "user";
                  const isAdmin = role === "admin";
                  const displayName = user.fullName || user.email || "Unknown";
                  const initial = (user.fullName || user.email || "?").charAt(0).toUpperCase();
                  const RoleIcon = ROLE_META[role].icon;

                  return (
                    <TableRow key={user.id} className={isSelf ? "bg-muted/30" : undefined}>
                      <TableCell className="max-w-0 sm:max-w-none">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 shrink-0">
                            <AvatarImage src={user.avatarUrl ?? ""} alt={displayName} />
                            <AvatarFallback>{initial}</AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <Text as="span" variant="body" weight="medium" className="truncate">
                                {displayName}
                              </Text>
                              {isSelf && (
                                <Badge variant="outline" className="shrink-0">You</Badge>
                              )}
                            </div>
                            {user.email && user.email !== displayName && (
                              <Mono className="truncate text-xs text-muted-foreground">
                                {user.email}
                              </Mono>
                            )}
                            <div className="sm:hidden">
                              <Badge variant={isAdmin ? "default" : "secondary"}>
                                <RoleIcon aria-hidden />
                                {ROLE_META[role].label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={isAdmin ? "default" : "secondary"}>
                          <RoleIcon aria-hidden />
                          {ROLE_META[role].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? (
                          // No actions on yourself: keeps the UI honest and avoids a
                          // dropdown with everything greyed out.
                          <Text as="span" variant="small">
                            <span aria-hidden>—</span>
                            <span className="sr-only">No actions available</span>
                          </Text>
                        ) : (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${displayName}`}
                              >
                                <MoreHorizontal />
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
                                      <UserCog />
                                      Impersonate
                                    </button>
                                  </DropdownMenuItem>
                                </form>
                              ) : (
                                <DropdownMenuItem disabled>
                                  <UserCog />
                                  Impersonate
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>
                                <Eyebrow size="sm">Set role</Eyebrow>
                              </DropdownMenuLabel>
                              {USER_ROLES.filter((r) => r !== role).map((nextRole) => {
                                const Icon = ROLE_META[nextRole].icon;
                                return (
                                  <DropdownMenuItem
                                    key={nextRole}
                                    // Let the menu close: held open with
                                    // preventDefault it stayed painted under
                                    // the confirm dialog and kept the page
                                    // inert after Cancel.
                                    onSelect={() => setPendingRoleChange({ user, nextRole })}
                                  >
                                    <Icon />
                                    {ROLE_META[nextRole].label}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => {
          if (!open && !isRolePending) setPendingRoleChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRoleChange
                ? `Change role to ${ROLE_META[pendingRoleChange.nextRole].label}?`
                : "Change role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange && (
                <>
                  <strong className="break-words">
                    {pendingRoleChange.user.fullName ?? pendingRoleChange.user.email}
                  </strong>{" "}
                  becomes {ROLE_META[pendingRoleChange.nextRole].label.toLowerCase()}:{" "}
                  {ROLE_META[pendingRoleChange.nextRole].hint.toLowerCase()}.
                  {pendingRoleChange.user.role === "admin" &&
                    pendingRoleChange.nextRole !== "admin" &&
                    " They lose admin access immediately."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRolePending}>Cancel</AlertDialogCancel>
            {/* Kept open until the save settles, so the pending label shows
                and a refusal ("you cannot demote yourself") has somewhere to land. */}
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRoleChange();
              }}
              disabled={isRolePending}
            >
              {isRolePending && <Spinner />}
              {isRolePending
                ? "Saving…"
                : pendingRoleChange
                  ? `Make ${ROLE_META[pendingRoleChange.nextRole].label.toLowerCase()}`
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
