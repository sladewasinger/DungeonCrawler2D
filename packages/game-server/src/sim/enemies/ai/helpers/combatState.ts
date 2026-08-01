import type { EnemySlot } from "../../../state/state.js";

export function isCommittedAttackAnimation(enemy: EnemySlot): boolean {
  const state = enemy.animation.state;
  return state === "windup" || state === "spit" || state === "recover" || state === "attack";
}
