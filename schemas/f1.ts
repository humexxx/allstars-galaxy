import { z } from "zod";

// A race's page, by its round in the URL. The bounds keep anything that is
// not a round number out of the lookup.
export const f1RoundSchema = z.coerce.number().int().min(1).max(40);

export type F1RoundData = z.infer<typeof f1RoundSchema>;
