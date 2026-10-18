import { z } from "zod";

import { idSchema } from "./common";

export const impersonationSchema = z.object({
  userId: idSchema,
});
