import { selectWeaponTargets, type Entity } from "@dc2d/engine";
import { combatants } from "../../core/helpers.js";
import type { ActiveMeleeAttack } from "../../state/meleeAttackState.js";
import type { PlayerSlot, SimState } from "../../state/state.js";

export function targetsForActiveMeleeAttack(input: {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly attack: ActiveMeleeAttack;
}): Entity[] {
  const { sim, slot, attack } = input;
  const targets = selectWeaponTargets({
    attacker: slot.entity,
    direction: attack.direction,
    candidates: combatants(sim),
    isPartyMember: (target) => isPartyMember(sim, slot, target),
    profile: attack.profile,
  });
  if (attack.profile.shape === "ground") return targets;
  const hostiles = targets.filter((target) => !isPartyMember(sim, slot, target));
  if (hostiles.length > 0) attack.hasContactedHostile = true;
  return attack.hasContactedHostile ? hostiles : targets;
}

function isPartyMember(sim: SimState, slot: PlayerSlot, target: Entity): boolean {
  if (target.kind !== "player" || slot.partyId === null) return false;
  return sim.players.get(target.id)?.partyId === slot.partyId;
}
