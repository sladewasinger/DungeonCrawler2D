/** Pure Zod schemas and defaults for modular character customization. */
import { z } from "zod";

export const BODY_STYLES = ["male", "female"] as const;
export const SKIN_TONES = ["fair", "warm", "tan", "bronze", "deep"] as const;
export const EYE_COLORS = ["brown", "blue", "green", "hazel", "amber", "violet"] as const;
export const HAIR_STYLES = ["short", "long", "spiky", "ponytail", "bald"] as const;
export const HAIR_COLORS = [
  "brown", "black", "blonde", "red", "silver", "teal",
  "auburn", "midnight", "rose", "violet", "emerald", "white",
  "pink-purple", "black-red", "midnight-cyan", "sunset-gold", "emerald-teal", "silver-violet",
] as const;

export const BodyStyleSchema = z.enum(BODY_STYLES);
export const SkinToneIdSchema = z.enum(SKIN_TONES);
export const EyeColorIdSchema = z.enum(EYE_COLORS);
export const HairStyleIdSchema = z.enum(HAIR_STYLES);
export const HairColorIdSchema = z.enum(HAIR_COLORS);

export const CharacterAppearanceSchema = z.object({
  body: BodyStyleSchema,
  skin: SkinToneIdSchema,
  eyeColor: EyeColorIdSchema.default("brown"),
  hairStyle: HairStyleIdSchema,
  hairColor: HairColorIdSchema,
});

export type BodyStyle = z.infer<typeof BodyStyleSchema>;
export type SkinToneId = z.infer<typeof SkinToneIdSchema>;
export type EyeColorId = z.infer<typeof EyeColorIdSchema>;
export type HairStyleId = z.infer<typeof HairStyleIdSchema>;
export type HairColorId = z.infer<typeof HairColorIdSchema>;
export type CharacterAppearance = z.infer<typeof CharacterAppearanceSchema>;

const LEGACY_BODY_MAP: Readonly<Record<string, (typeof BODY_STYLES)[number]>> = {
  classic: "male",
  slender: "female",
};

function normalizeLegacyAppearance(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Record<string, unknown>;
  const mapped = typeof record.body === "string" ? LEGACY_BODY_MAP[record.body] : undefined;
  return mapped ? { ...record, body: mapped } : raw;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  body: "male",
  skin: "warm",
  eyeColor: "brown",
  hairStyle: "short",
  hairColor: "brown",
};

export function sanitizeCharacterAppearance(raw: unknown): CharacterAppearance {
  const parsed = CharacterAppearanceSchema.safeParse(normalizeLegacyAppearance(raw));
  return parsed.success ? parsed.data : { ...DEFAULT_APPEARANCE };
}
