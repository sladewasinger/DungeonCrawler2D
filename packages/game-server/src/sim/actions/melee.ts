import {
  ATTACK_COOLDOWN_MS,
  FIST_DAMAGE,
  KNOCKBACK_FORCE,
  PARTY_FRIENDLY_FIRE_SCALE,
  TICK_RATE,
  applyKnockback,
  faceEntity,
  pickMeleeTarget,
  type Entity,
  type EffectEvent,
  type ItemDef,
} from "@dc2d/engine";
import { combatants, damageGivenMultiplierFor, effectTargetFor } from "../core/helpers.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import { blocksAttackFrom } from "../players/directionalBlock.js";

/** Melee swing resolution: cooldown gating, targeting-aid, damage, knockback. */

export interface AttackContext {
  sim: SimState;
  slot: PlayerSlot;
  dirX: number;
  dirY: number;
  effectEvents: EffectEvent[];
}

interface HitContext {
  sim: SimState;
  attacker: Entity;
  weaponDef: ItemDef | undefined;
  victim: Entity;
  effectEvents: EffectEvent[];
}

interface WeaponStatusContext {
  sim: SimState;
  attacker: Entity;
  victim: Entity;
  weaponDef: ItemDef | undefined;
  target: ReturnType<typeof effectTargetFor>;
  effectEvents: EffectEvent[];
}

export function doAttack({ sim, slot, dirX, dirY, effectEvents }: AttackContext): void {
  const attacker = slot.entity;
  faceEntity(attacker, dirX, dirY);
  if (slot.blocking) return;
  if (sim.effects.inSanctuary(attacker)) return; // no fighting in safe rooms
  const weaponDef = equippedWeapon(sim, slot);
  if (sim.tickCount < slot.attackReadyAtTick) return; // swing still recovering
  slot.attackReadyAtTick = sim.tickCount + attackCooldownTicks(weaponDef);
  slot.attackStartedAtTick = sim.tickCount;
  const victim = targetForAttack({ sim, slot, weaponDef, dirX, dirY });
  if (victim) resolveHit({ sim, attacker, weaponDef, victim, effectEvents });
}

function equippedWeapon(sim: SimState, slot: PlayerSlot): ItemDef | undefined {
  return slot.weapon ? sim.content.items.get(slot.weapon) : undefined;
}

function attackCooldownTicks(weaponDef: ItemDef | undefined): number {
  const cooldownMs = weaponDef?.weapon?.cooldownMs ?? ATTACK_COOLDOWN_MS;
  return Math.round((cooldownMs / 1000) * TICK_RATE);
}

function isPartyMember(sim: SimState, slot: PlayerSlot, target: Entity): boolean {
  if (target.kind !== "player" || slot.partyId === null) return false;
  return sim.players.get(target.id)?.partyId === slot.partyId;
}

/** Damage, status applies, knockback, and the downed-player finisher for one swing. */
function targetForAttack({ sim, slot, weaponDef, dirX, dirY }: Pick<AttackContext, "sim" | "slot" | "dirX" | "dirY"> & { weaponDef: ItemDef | undefined }): Entity | null {
  return pickMeleeTarget({
    attacker: slot.entity,
    direction: { x: dirX, y: dirY },
    candidates: combatants(sim),
    isPartyMember: (target) => isPartyMember(sim, slot, target),
    ...(weaponDef?.weapon?.range !== undefined ? { range: weaponDef.weapon.range } : {}),
    ...(weaponDef?.weapon?.arcCos !== undefined ? { arcCos: weaponDef.weapon.arcCos } : {}),
  });
}

function resolveHit({ sim, attacker, weaponDef, victim, effectEvents }: HitContext): void {
  if (meleeHitIsBlocked(sim, victim, attacker)) return;
  const damage = meleeDamage({ sim, attacker, victim, weaponDef });
  recordPlayerAttacker(sim, attacker, victim);
  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth({
    entity: victim,
    amount: -damage,
    events: effectEvents,
    opts: { sourceTags: weaponDef?.tags ?? [], sourceId: attacker.id },
    target,
  });
  applyWeaponStatuses({ sim, attacker, victim, weaponDef, target, effectEvents });
  applyKnockback(victim.body, {
    dirX: victim.body.x - attacker.body.x,
    dirY: victim.body.y - attacker.body.y,
    force: KNOCKBACK_FORCE,
  });
  finishIfDownedPlayer(sim, victim, effectEvents);
}

function meleeDamage({ sim, attacker, victim, weaponDef }: Pick<HitContext, "sim" | "attacker" | "victim" | "weaponDef">): number {
  return (weaponDef?.weapon?.damage ?? FIST_DAMAGE) * damageScaleFor(sim, attacker, victim) * damageGivenMultiplierFor(sim, attacker);
}

function recordPlayerAttacker(sim: SimState, attacker: Entity, victim: Entity): void {
  if (attacker.kind !== "player" || victim.kind !== "player") return;
  const victimSlot = sim.players.get(victim.id);
  if (victimSlot) victimSlot.lastDamagedByPlayerId = attacker.id;
}

function meleeHitIsBlocked(sim: SimState, victim: Entity, attacker: Entity): boolean {
  const victimSlot = victim.kind === "player"
    ? sim.players.get(victim.id)
    : undefined;
  return blocksAttackFrom(victimSlot, attacker);
}

function applyWeaponStatuses({ sim, attacker, victim, weaponDef, target, effectEvents }: WeaponStatusContext): void {
  for (const apply of weaponDef?.weapon?.applies ?? []) {
    if (sim.rng.next() < apply.chance) {
      sim.effects.applyStatus({
        entity: victim,
        statusId: apply.status,
        events: effectEvents,
        target,
        sourceId: attacker.id,
      });
    }
  }
}

/** Partying preserves friendly fire, but halves direct melee damage between members. */
function damageScaleFor(sim: SimState, attacker: Entity, victim: Entity): number {
  if (attacker.kind !== "player" || victim.kind !== "player") return 1;
  const attackerParty = sim.players.get(attacker.id)?.partyId;
  const victimParty = sim.players.get(victim.id)?.partyId;
  return typeof attackerParty === "string" && attackerParty === victimParty
    ? PARTY_FRIENDLY_FIRE_SCALE
    : 1;
}

/** Striking a downed player finishes them. */
function finishIfDownedPlayer(sim: SimState, victim: Entity, effectEvents: EffectEvent[]): void {
  if (victim.kind !== "player") return;
  const vSlot = sim.players.get(victim.id);
  if (!vSlot || vSlot.downedAtTick === null) return;
  victim.hp = 0;
  effectEvents.push({ t: "death", id: victim.id });
}
