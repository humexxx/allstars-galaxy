import { z } from "zod";

import { USER_ROLES } from "@/types/user";

/** Zod view of the single `UserRole` definition in `types/user.ts`. */
export const userRoleSchema = z.enum(USER_ROLES);

export type { UserRole } from "@/types/user";
