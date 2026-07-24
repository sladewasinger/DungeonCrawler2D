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
import { combatants, effectTargetFor } from "../helpers.js";
import type { PlayerSlot, SimState } from "../state.js";

/** Melee swing resolution: cooldown gating, targeting-aid, damage, knockback. */

const ATTACK_COOLDOWN_TICKS = Math.round((ATTACK_COOLDOWN_MS / 1000) * TICK_RATE);

export function doAttack(
  sim: SimState,
  slot: PlayerSlot,
  dirX: number,
  dirY: number,
  effectEvents: EffectEvent[],
): void {
  const attacker = slot.entity;
  faceEntity(attacker, dirX, dirY);
  if (sim.effects.inSanctuary(attacker)) return; // no fighting in safe rooms
  if (sim.tickCount < slot.attackReadyAtTick) return; // swing still recovering
  slot.attackReadyAtTick = sim.tickCount + ATTACK_COOLDOWN_TICKS;
  slot.attackStartedAtTick = sim.tickCount;
  // Melee swings use the EQUIPPED weapon (character slot, not hotbar).
  const weaponDef = slot.weapon ? sim.content.items.get(slot.weapon) : undefined;

  const victim = pickMeleeTarget(attacker, dirX, dirY, combatants(sim), (target) =>
    target.kind === "player" &&
    slot.partyId !== null &&
    sim.players.get(target.id)?.partyId === slot.partyId,
  );
  if (victim) resolveHit(sim, attacker, weaponDef, victim, effectEvents);
}

/** Damage, status applies, knockback, and the downed-player finisher for one swing. */
function resolveHit(
  sim: SimState,
  attacker: Entity,
  weaponDef: ItemDef | undefined,
  victim: Entity,
  effectEvents: EffectEvent[],
): void {
  const weapon = weaponDef?.weapon;
  const damage = (weapon?.damage ?? FIST_DAMAGE) * damageScaleFor(sim, attacker, victim);
  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth(victim, -damage, effectEvents, { sourceTags: weaponDef?.tags ?? [] }, target);
  for (const apply of weapon?.applies ?? []) {
    if (sim.rng.next() < apply.chance) sim.effects.applyStatus(victim, apply.status, effectEvents, target);
  }
  applyKnockback(
    victim.body,
    victim.body.x - attacker.body.x,
    victim.body.y - attacker.body.y,
    KNOCKBACK_FORCE,
  );
  finishIfDownedPlayer(sim, victim, effectEvents);
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
