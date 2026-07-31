import {
  combatHurtbox,
  guardVolume,
  PROJECTILE_CONTACT_RADIUS,
  type AdminHitbox,
} from "@dc2d/engine";
import { ELEMENTAL_ENEMY_TUNING } from "../../enemies/elemental/configuration/elementalEnemyTuning.js";
import type { EnemySlot } from "../../state/enemyState.js";
import { activeMeleeAttackFor } from "../../state/meleeAttackState.js";
import { activeTrainingWeaponHitbox } from "../../enemies/training/trainingDummyAttack.js";
import {
  adminDebugFlagEnabled,
  type AdminEntityDebug,
  type AdminMapDebugInput,
} from "../adminMapDebugTypes.js";

export function adminCombatDebug(
  input: AdminMapDebugInput,
): Pick<AdminEntityDebug, "hurtbox" | "attacks" | "guard"> {
  return {
    ...(adminDebugFlagEnabled(input, "hurtboxes") ? combatHurtboxDebug(input) : {}),
    ...(adminDebugFlagEnabled(input, "attacks") ? hitboxDebug(input) : {}),
    ...(adminDebugFlagEnabled(input, "guards") ? guardDebug(input) : {}),
  };
}

function combatHurtboxDebug(
  input: AdminMapDebugInput,
): Pick<AdminEntityDebug, "hurtbox"> {
  const { entity } = input;
  if (entity.kind !== "player" && entity.kind !== "enemy") return {};
  return { hurtbox: { ...combatHurtbox(entity) } };
}

function hitboxDebug(input: AdminMapDebugInput): Pick<AdminEntityDebug, "attacks"> {
  const hitboxes = activeHitboxes(input);
  return hitboxes.length > 0 ? { attacks: hitboxes } : {};
}

function activeHitboxes(input: AdminMapDebugInput): AdminHitbox[] {
  return [
    ...activePlayerAttack(input),
    ...activeEnemyAttack(input),
    ...activeProjectileAttack(input),
  ];
}

function activePlayerAttack(input: AdminMapDebugInput): AdminHitbox[] {
  const player = input.sim.players.get(input.entity.id);
  const attack = player ? activeMeleeAttackFor(player) : undefined;
  if (!attack) return [];
  if (attack.profile.shape === "ground") {
    return [{ shape: "circle", radius: attack.profile.range }];
  }
  return [{
    shape: "cone",
    direction: { ...attack.direction },
    range: attack.profile.range,
    arcCos: attack.profile.arcCos,
  }];
}

function activeEnemyAttack(input: AdminMapDebugInput): AdminHitbox[] {
  const enemy = input.sim.enemies.get(input.entity.id);
  if (!enemy) return [];
  return [
    ...activeTrainingHitbox(enemy),
    ...activeDirectionalFlameAreas(input, enemy),
  ];
}

function activeTrainingHitbox(enemy: EnemySlot): AdminHitbox[] {
  const hitbox = activeTrainingWeaponHitbox(enemy);
  if (!hitbox) return [];
  if (hitbox.profile.shape === "ground") {
    return [{ shape: "circle", radius: hitbox.profile.range }];
  }
  return [{
    shape: "cone",
    direction: { ...hitbox.direction },
    range: hitbox.profile.range,
    arcCos: hitbox.profile.arcCos,
  }];
}

function activeDirectionalFlameAreas(
  input: AdminMapDebugInput,
  enemy: EnemySlot,
): AdminHitbox[] {
  const state = enemy.elementalAttack;
  if (state?.kind !== "directional-flame") return [];
  return directionalFlameCells(state)
    .filter((tile) => directionalFlameBelongsTo(input, enemy, tile))
    .map((tile) => ({
      shape: "tile" as const,
      center: { x: tile.x + 0.5, y: tile.y + 0.5, z: enemy.entity.body.z },
    }));
}

function directionalFlameCells(
  state: NonNullable<EnemySlot["elementalAttack"]>,
): Array<{ readonly x: number; readonly y: number }> {
  const cells = [];
  for (let segment = 1; segment <= state.maximumSegments; segment += 1) {
    cells.push({
      x: state.originTileX + state.stepX * segment,
      y: state.originTileY + state.stepY * segment,
    });
  }
  return cells;
}

function directionalFlameBelongsTo(
  input: AdminMapDebugInput,
  enemy: EnemySlot,
  tile: { readonly x: number; readonly y: number },
): boolean {
  return input.sim.areas.sourceIdFor(
    tile.x,
    tile.y,
    ELEMENTAL_ENEMY_TUNING.directionalFlame.areaId,
  ) === enemy.entity.id;
}

function activeProjectileAttack(input: AdminMapDebugInput): AdminHitbox[] {
  const { entity } = input;
  if (entity.kind !== "projectile" || !entity.directProjectileImpact) return [];
  return [{ shape: "circle", radius: PROJECTILE_CONTACT_RADIUS }];
}

function guardDebug(input: AdminMapDebugInput): Pick<AdminEntityDebug, "guard"> {
  const player = input.sim.players.get(input.entity.id);
  if (!player?.blocking) return {};
  const guard = guardVolume({
    center: input.entity.body,
    facing: input.entity.facing ?? { x: 1, y: 0 },
  });
  return {
    guard: {
      direction: guard.facing,
      radius: guard.radius,
      arcCos: guard.arcCos,
    },
  };
}
