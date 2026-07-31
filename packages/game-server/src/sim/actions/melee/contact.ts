import {
  PARTY_FRIENDLY_FIRE_SCALE,
  applyKnockback,
  knockbackForWeapon,
  type Entity,
  type EffectEvent,
  type WeaponProfile,
} from "@dc2d/engine";
import { damageGivenMultiplierFor, effectTargetFor } from "../../core/helpers.js";
import { notifyBlockFeedback } from "../../combat/blockFeedback.js";
import { blocksAttackFrom } from "../../players/directionalBlock.js";
import type { ActiveMeleeAttack } from "../../state/meleeAttackState.js";
import type { SimState } from "../../state/state.js";

export interface MeleeContact {
  readonly sim: SimState;
  readonly attacker: Entity;
  readonly attack: ActiveMeleeAttack;
  readonly victim: Entity;
  readonly effectEvents: EffectEvent[];
}

export function resolveMeleeContact(input: MeleeContact): void {
  const { sim, attacker, attack, victim, effectEvents } = input;
  if (attack.contactedEntityIds.has(victim.id)) return;
  attack.contactedEntityIds.add(victim.id);
  if (meleeHitIsBlocked(sim, victim, attacker)) {
    notifyBlockFeedback(sim, victim, "melee");
    return;
  }
  const target = effectTargetFor(sim, victim);
  const damage = meleeDamage({ sim, attacker, victim, profile: attack.profile });
  recordPlayerAttacker(sim, attacker, victim);
  sim.effects.modifyHealth({
    entity: victim,
    amount: -damage,
    events: effectEvents,
    opts: { sourceTags: attack.sourceTags, sourceId: attacker.id },
    target,
  });
  applyWeaponStatuses({ sim, attacker, victim, attack, target, effectEvents });
  applyKnockback(victim.body, knockbackForWeapon(attacker, victim, attack.profile));
  finishIfDownedPlayer(sim, victim, effectEvents);
}

function meleeDamage(input: {
  readonly sim: SimState;
  readonly attacker: Entity;
  readonly victim: Entity;
  readonly profile: WeaponProfile;
}): number {
  const { sim, attacker, victim, profile } = input;
  return profile.damage * damageScaleFor(sim, attacker, victim) *
    damageGivenMultiplierFor(sim, attacker);
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

function applyWeaponStatuses(input: {
  readonly sim: SimState;
  readonly attacker: Entity;
  readonly victim: Entity;
  readonly attack: ActiveMeleeAttack;
  readonly target: ReturnType<typeof effectTargetFor>;
  readonly effectEvents: EffectEvent[];
}): void {
  const { sim, attacker, victim, attack, target, effectEvents } = input;
  for (const apply of attack.statusApplies) {
    if (sim.rng.next() >= apply.chance) continue;
    sim.effects.applyStatus({
      entity: victim,
      statusId: apply.status,
      events: effectEvents,
      target,
      sourceId: attacker.id,
    });
  }
}

function damageScaleFor(sim: SimState, attacker: Entity, victim: Entity): number {
  if (attacker.kind !== "player" || victim.kind !== "player") return 1;
  const attackerParty = sim.players.get(attacker.id)?.partyId;
  const victimParty = sim.players.get(victim.id)?.partyId;
  return typeof attackerParty === "string" && attackerParty === victimParty
    ? PARTY_FRIENDLY_FIRE_SCALE
    : 1;
}

function finishIfDownedPlayer(sim: SimState, victim: Entity, effectEvents: EffectEvent[]): void {
  if (victim.kind !== "player") return;
  const victimSlot = sim.players.get(victim.id);
  if (!victimSlot || victimSlot.downedAtTick === null) return;
  victim.hp = 0;
  effectEvents.push({ t: "death", id: victim.id });
}
