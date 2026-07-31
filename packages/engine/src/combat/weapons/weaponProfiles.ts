import {
  ATTACK_COOLDOWN_MS,
  FIST_DAMAGE,
  KNOCKBACK_FORCE,
  MELEE_ARC_COS,
  MELEE_RANGE,
} from "../../core/constants.js";
import { z } from "zod";

export const attackShapeSchema = z.enum(["cone", "ground"]);

export const attackProfileInputSchema = z.object({
  profileId: z.string().max(64).optional(),
  damage: z.number().positive(),
  range: z.number().positive().optional(),
  cooldownMs: z.number().int().positive().optional(),
  arcCos: z.number().min(-1).max(1).optional(),
  shape: attackShapeSchema.optional(),
  knockbackForce: z.number().nonnegative().optional(),
});

export const attackProfileSchema = z.object({
  profileId: z.string().max(64).optional(),
  damage: z.number().positive(),
  range: z.number().positive(),
  cooldownMs: z.number().int().positive(),
  arcCos: z.number().min(-1).max(1),
  shape: attackShapeSchema,
  knockbackForce: z.number().nonnegative(),
});

export type WeaponAttackShape = z.infer<typeof attackShapeSchema>;
export type AttackProfileInput = z.infer<typeof attackProfileInputSchema>;

export interface AttackProfile {
  readonly profileId?: string | undefined;
  readonly damage: number;
  readonly range: number;
  readonly cooldownMs: number;
  readonly arcCos: number;
  readonly shape: WeaponAttackShape;
  readonly knockbackForce: number;
}

export type WeaponProfile = AttackProfile;
type WeaponDefinition = AttackProfileInput;

export function resolveWeaponProfile(
  definition?: { readonly weapon?: WeaponDefinition | undefined } | undefined,
): AttackProfile {
  return attackProfileSchema.parse(profileValues(definition?.weapon));
}

function profileValues(weapon: WeaponDefinition | undefined): AttackProfileInput {
  const {
    profileId,
    damage = FIST_DAMAGE,
    range = MELEE_RANGE,
    cooldownMs = ATTACK_COOLDOWN_MS,
    arcCos = MELEE_ARC_COS,
    shape = "cone",
    knockbackForce = KNOCKBACK_FORCE,
  } = weapon ?? {};
  const values = {
    damage,
    range,
    cooldownMs,
    arcCos,
    shape,
    knockbackForce,
  };
  return withProfileId(values, profileId);
}

function withProfileId(
  values: Omit<AttackProfileInput, "profileId">,
  profileId: string | undefined,
): AttackProfileInput {
  if (profileId === undefined) return values;
  return { ...values, profileId };
}
