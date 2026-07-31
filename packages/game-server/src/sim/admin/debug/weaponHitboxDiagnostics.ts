import {
  resolveWeaponProfile,
  WEAPON_HITBOX_TUNING,
  type AdminHitbox,
  type WeaponProfile,
} from "@dc2d/engine";
import type { EnemySlot } from "../../state/enemyState.js";
import { activeMeleeAttackFor } from "../../state/meleeAttackState.js";
import { activeTrainingWeaponHitbox } from "../../enemies/training/trainingDummyAttack.js";
import type { AdminMapDebugInput } from "../adminMapDebugTypes.js";

const VOLUME = {
  strikeHeightOffset: WEAPON_HITBOX_TUNING.strikeHeightOffset,
  verticalHalfExtent: WEAPON_HITBOX_TUNING.verticalHalfExtent,
} as const;

export function activePlayerWeaponHitbox(input: AdminMapDebugInput): AdminHitbox[] {
  const player = input.sim.players.get(input.entity.id);
  const attack = player ? activeMeleeAttackFor(player) : undefined;
  return attack ? [weaponHitbox(attack.profile, attack.direction)] : [];
}

export function activeTrainingWeaponHitboxDebug(enemy: EnemySlot): AdminHitbox[] {
  const active = activeTrainingWeaponHitbox(enemy);
  return active ? [weaponHitbox(active.profile, active.direction)] : [];
}

export function previewWeaponHitboxes(input: AdminMapDebugInput): AdminHitbox[] {
  return [
    ...playerPreview(input),
    ...trainingPreview(input),
  ];
}

function playerPreview(input: AdminMapDebugInput): AdminHitbox[] {
  const player = input.sim.players.get(input.entity.id);
  if (!player) return [];
  const weapon = player.weapon
    ? input.sim.content.items.get(player.weapon)
    : undefined;
  return [weaponHitbox(
    resolveWeaponProfile(weapon),
    input.entity.facing ?? { x: 1, y: 0 },
    true,
  )];
}

function trainingPreview(input: AdminMapDebugInput): AdminHitbox[] {
  const enemy = input.sim.enemies.get(input.entity.id);
  const itemId = enemy?.def.trainingWeapon?.itemId;
  const weapon = itemId ? input.sim.content.items.get(itemId) : undefined;
  if (!enemy || !weapon?.weapon) return [];
  return [weaponHitbox(
    resolveWeaponProfile(weapon),
    input.entity.facing ?? { x: 1, y: 0 },
    true,
  )];
}

function weaponHitbox(
  profile: WeaponProfile,
  direction: { readonly x: number; readonly y: number },
  preview = false,
): AdminHitbox {
  const volume = { ...VOLUME, ...(preview ? { preview: true as const } : {}) };
  if (profile.shape === "ground") {
    return { shape: "circle", radius: profile.range, ...volume };
  }
  return {
    shape: "cone",
    direction: { ...direction },
    range: profile.range,
    arcCos: profile.arcCos,
    ...volume,
  };
}
