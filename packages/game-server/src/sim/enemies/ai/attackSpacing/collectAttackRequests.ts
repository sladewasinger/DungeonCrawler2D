import { type EnemyDecision } from "@dc2d/engine";
import type { EnemySlot } from "../../../state/state.js";
import type { AttackMode, AttackRequest } from "./attackSpacingTypes.js";

export function collectAttackRequests(input: {
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly decisions: ReadonlyMap<string, EnemyDecision>;
  readonly mode: AttackMode;
}): Map<string, AttackRequest[]> {
  const byTarget = new Map<string, AttackRequest[]>();

  for (const enemy of input.enemies) {
    const decision = input.decisions.get(enemy.entity.id);
    const target = input.targets.get(enemy.entity.id);
    if (!decision || !target || !isParticipant(enemy, input.mode)) continue;

    const targetId = target.id;

    const existing = byTarget.get(targetId) ?? [];
    existing.push({ enemy, decision, target });
    byTarget.set(targetId, existing);
  }

  return byTarget;
}

function isParticipant(enemy: EnemySlot, mode: AttackMode): boolean {
  return mode === "melee" ? !enemy.def.attack.ranged : enemy.def.attack.ranged === true;
}
