/** Pure Zod schemas and defaults for modular character customization. */
import { z } from "zod";

export const BODY_STYLES = ["classic", "slender"] as const;
export const SKIN_TONES = ["fair", "warm", "tan", "bronze", "deep"] as const;
export const HAIR_STYLES = ["short", "long", "spiky", "ponytail", "bald"] as const;
export const HAIR_COLORS = ["brown", "black", "blonde", "red", "silver", "teal"] as const;

export const BodyStyleSchema = z.enum(BODY_STYLES);
export const SkinToneIdSchema = z.enum(SKIN_TONES);
export const HairStyleIdSchema = z.enum(HAIR_STYLES);
export const HairColorIdSchema = z.enum(HAIR_COLORS);

export const CharacterAppearanceSchema = z.object({
  body: BodyStyleSchema,
  skin: SkinToneIdSchema,
  hairStyle: HairStyleIdSchema,
  hairColor: HairColorIdSchema,
});

export type BodyStyle = z.infer<typeof BodyStyleSchema>;
export type SkinToneId = z.infer<typeof SkinToneIdSchema>;
export type HairStyleId = z.infer<typeof HairStyleIdSchema>;
export type HairColorId = z.infer<typeof HairColorIdSchema>;
export type CharacterAppearance = z.infer<typeof CharacterAppearanceSchema>;

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  body: "classic",
  skin: "warm",
  hairStyle: "short",
  hairColor: "brown",
};

export function sanitizeCharacterAppearance(raw: unknown): CharacterAppearance {
  const parsed = CharacterAppearanceSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_APPEARANCE };
}
