import {
  GRAVITY,
  TICK_RATE,
  createBody,
  faceEntity,
  makeEntity,
  newEntityId,
  resolveWeaponProfile,
  type EffectEvent,
  type ItemRangedDef,
} from "@dc2d/engine";
import { damageGivenMultiplierFor } from "../core/helpers.js";
import { invRemove } from "../inventory/inventory.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { startActiveMeleeAttack } from "./melee/attackWindow.js";

export { stepActiveMeleeAttacks } from "./melee/attackWindow.js";

/** Starts an accepted player swing or bow shot. */
export interface AttackContext {
  sim: SimState;
  slot: PlayerSlot;
  dirX: number;
  dirY: number;
  drawRatio?: number;
  effectEvents: EffectEvent[];
}

export function doAttack({ sim, slot, dirX, dirY, drawRatio, effectEvents }: AttackContext): void {
  const attacker = slot.entity;
  faceEntity(attacker, dirX, dirY);
  if (slot.blocking || sim.effects.inSanctuary(attacker)) return;
  if (sim.tickCount < slot.attackReadyAtTick) return;
  const weaponDef = slot.weapon ? sim.content.items.get(slot.weapon) : undefined;
  if (weaponDef?.ranged) {
    fireRangedWeapon({ sim, slot, ranged: weaponDef.ranged, dirX, dirY, drawRatio });
    return;
  }
  const profile = resolveWeaponProfile(weaponDef);
  slot.attackReadyAtTick = sim.tickCount + attackCooldownTicks(profile.cooldownMs);
  slot.attackStartedAtTick = sim.tickCount;
  startActiveMeleeAttack({
    sim,
    slot,
    weaponDef,
    profile,
    direction: { x: dirX, y: dirY },
    effectEvents,
  });
}

interface RangedFireRequest {
  sim: SimState;
  slot: PlayerSlot;
  ranged: ItemRangedDef;
  dirX: number;
  dirY: number;
  drawRatio?: number | undefined;
}

function fireRangedWeapon(request: RangedFireRequest): void {
  const { sim, slot, ranged, dirX, dirY, drawRatio } = request;
  if (!invRemove(slot, ranged.ammoItem, 1)) {
    slot.outbox.push({ t: "toast", msg: `Out of ${ranged.ammoItem}s` });
    return;
  }
  slot.attackReadyAtTick = sim.tickCount + attackCooldownTicks(ranged.cooldownMs);
  const ratio = Math.max(0.15, Math.min(1, drawRatio ?? 0.65));
  const projectile = createRangedProjectile({ sim, attacker: slot.entity, ranged, dirX, dirY, ratio });
  sim.projectiles.set(projectile.id, projectile);
}

function createRangedProjectile(input: {
  sim: SimState;
  attacker: PlayerSlot["entity"];
  ranged: ItemRangedDef;
  dirX: number;
  dirY: number;
  ratio: number;
}) {
  const { sim, attacker, ranged, dirX, dirY, ratio } = input;
  const len = Math.hypot(dirX, dirY) || 1;
  const speed = 7 + (ranged.maxSpeed - 7) * ratio;
  const targetRange = 1.6 + (ranged.maxRange - 1.6) * (ratio * ratio);
  const baseDamage = ranged.minDamage + (ranged.maxDamage - ranged.minDamage) * ratio;
  const origin = { x: attacker.body.x, y: attacker.body.y, z: attacker.body.z + 0.45 };
  const vx = (dirX / len) * speed;
  const vy = (dirY / len) * speed;
  const flightTime = Math.max(0.08, targetRange / speed);
  const arrowGravity = GRAVITY * 0.12;
  const vz = 0.5 * arrowGravity * flightTime - 0.45 / flightTime;
  return makeEntity("projectile", createBody(origin.x, origin.y, origin.z), {
    id: newEntityId("j"),
    defId: ranged.ammoItem,
    ownerId: attacker.id,
    tags: new Set(["arrow", "sharp"]),
    directProjectileImpact: {
      damage: baseDamage * damageGivenMultiplierFor(sim, attacker),
      applies: ratio >= 0.85 ? [{ status: "bleeding", chance: 0.35 }] : [],
    },
    vel: { x: vx, y: vy, z: vz },
  });
}

function attackCooldownTicks(cooldownMs: number): number {
  return Math.round((cooldownMs / 1000) * TICK_RATE);
}
