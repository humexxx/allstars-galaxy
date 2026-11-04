import { z } from "zod";

// A race's page, by its round in the URL: digits only, no leading zero.
// Number() also reads "1.0", "0x3" and "1e1", which would give one race
// several addresses. Whether the round exists is the loader's to say.
export const f1RoundSchema = z.string().regex(/^[1-9]\d?$/).transform(Number);

export type F1RoundData = z.infer<typeof f1RoundSchema>;
