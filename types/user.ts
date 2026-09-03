/**
 * Derived from the `user_role` enum in `db/schema.ts`. Kept in one place
 * because the roles were spelled out by hand in ten files, which is how a
 * new role ends up half-added.
 */
export const USER_ROLES = ["admin", "provider", "user"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

export interface AuthUser {
  name: string
}

export type UserListItem = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UserRole | null;
  avatarUrl: string | null;
};
