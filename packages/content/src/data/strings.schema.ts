// Zod schema for strings.json — canonical narrative copy (Epic 7.13, book-fan
// lane) so title-screen prose lives in content, never hardcoded in a lane's UI.
import { z } from "zod";

export const stringsSchema = z.object({
  /** The Dungeon's premise, in the books' dry AI-broadcast voice. */
  premise: z.string(),
  /** Short line pairing with the premise (title screen, loading, etc). */
  tagline: z.string(),
});
export type Strings = z.infer<typeof stringsSchema>;

/**
 * Not yet wired into buildContentRegistry/RawContent (packages/engine/src/
 * effects/registry.ts) — that file, parse.ts, and validate.ts sit outside
 * this lane's ownership this wave (ASSUMPTION #102, docs/ASSUMPTIONS.md).
 * The onboarding lane that owns the title screen should register this
 * schema alongside the other five when it wires strings.json in.
 */
export function parseStrings(raw: unknown): Strings {
  return stringsSchema.parse(raw);
}
