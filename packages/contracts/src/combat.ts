/** Shared combat, AI state, gore, weapon archetype, and composable effect contracts. */

export const GORE_SUBSTANCES = ["blood", "slime", "ichor", "straw", "bone", "stone"] as const;
export type GoreSubstance = (typeof GORE_SUBSTANCES)[number];

export const GORE_STYLES = ["splatter", "thin-streak", "drip", "chunk-spray", "explode-away"] as const;
export type GoreStyle = (typeof GORE_STYLES)[number];

export const WEAPON_ARCHETYPES = [
  "sword", "axe", "pickaxe", "torch", "unarmed", "spear", "dagger", "greatsword",
] as const;
export type WeaponArchetype = (typeof WEAPON_ARCHETYPES)[number];

export type AttackMotionKind = "slash" | "backhand" | "lunge" | "chop" | "overheadSlam" | "thrust" | "cleave" | "punch";
export type HarvestToolKind = "none" | "wood" | "stone" | "forage";

export const ENTITY_KINDS = [
  "dummy", "slime-dummy", "spar-dummy",
  "wolf", "bear", "spider", "boar", "slime",
  "goblin", "orc", "skeleton", "golem",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];
export type CreatureKind = EntityKind;

export const WILDLIFE_KINDS = [
  "wolf", "bear", "spider", "boar", "slime",
  "goblin", "orc", "skeleton", "golem",
] as const;
export type WildlifeKind = (typeof WILDLIFE_KINDS)[number];

export const AI_STATES = [
  "idle", "patrol", "alert", "investigate", "chase", "flank", "charge", "ambush", "feed", "return", "dead",
] as const;
export type AiState = (typeof AI_STATES)[number];

export type DamageElement = "physical" | "fire" | "poison" | "bleed" | "shadow";
export type DamageKind = "melee" | "projectile" | "dot" | "thorns" | "hazard";
export type AmmoKind = "arrow" | "pebble" | "stone";

export type EffectTrigger =
  | "on_melee_hit"
  | "on_crit"
  | "on_kill"
  | "on_block"
  | "on_parry"
  | "on_dodge"
  | "on_damaged"
  | "on_consume"
  | "on_equip_passive"
  | "on_interval";

export type EffectAction =
  | { readonly op: "apply_status"; readonly statusId: string; readonly stacks: number; readonly durationSec: number }
  | { readonly op: "deal_aoe_damage"; readonly element: DamageElement; readonly radiusTiles: number; readonly weaponDamageMult: number }
  | { readonly op: "restore_vital"; readonly vital: "hp" | "stamina"; readonly flat?: number; readonly fractionOfDamage?: number }
  | { readonly op: "spawn_hazard"; readonly hazardId: string; readonly radiusTiles: number; readonly durationSec: number }
  | { readonly op: "modify_stat"; readonly stat: string; readonly add?: number; readonly mult?: number };

export interface EffectRule {
  readonly trigger: EffectTrigger;
  readonly chance?: number | undefined;
  readonly internalCooldownSec?: number | undefined;
  readonly actions: readonly EffectAction[];
}
