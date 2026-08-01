/** Owns server-authoritative ranged burst selection, target safety, and release poses. */
import type { EnemySlot, SimState } from "../../../state/state.js";
import { isSpawnProtected } from "../../../spawnSafety/spawnSafety.js";
import { beginElementalEnemyAttack } from "../../elemental/elementalEnemyAttack.js";
import { launchSpit } from "../combat.js";
import { rangeReleaseTarget, spitAnimation } from "./helpers.js";

export function liveRangedReleaseTarget(
  sim: SimState,
  enemy: EnemySlot,
): EnemySlot["animation"]["target"] {
  const target = enemy.animation.target;
  if (!target || !isRangedTargetable(sim, target.targetId)) return undefined;
  return rangeReleaseTarget(sim, enemy, target);
}

function isRangedTargetable(sim: SimState, targetId: string): boolean {
  const player = sim.players.get(targetId);
  return player !== undefined &&
    player.connected &&
    player.entity.hp > 0 &&
    player.downedAtTick === null &&
    !isSpawnProtected(player, sim.tickCount) &&
    !sim.effects.inSanctuary(player.entity);
}

export function selectBurstRemainder(
  sim: SimState,
  enemy: EnemySlot,
): number | undefined {
  if (enemy.def.attack.elemental === "oil-lob") return undefined;
  return sim.rng.int(1, 2) > 1 ? 1 : undefined;
}

export function nextBurstRemainder(
  enemy: EnemySlot,
): number | undefined {
  const remaining = enemy.animation.releasesRemaining ?? 0;
  return remaining > 1 ? remaining - 1 : undefined;
}

export function hasPendingRelease(enemy: EnemySlot): boolean {
  return (enemy.animation.releasesRemaining ?? 0) > 0;
}

export function releaseRangedAttack(input: {
  sim: SimState;
  enemy: EnemySlot;
  target: NonNullable<EnemySlot["animation"]["target"]>;
}): void {
  if (beginElementalEnemyAttack(input)) return;
  launchSpit(input);
}

export function rangedSpitPose(
  target: NonNullable<EnemySlot["animation"]["target"]>,
  releasesRemaining: number | undefined,
): EnemySlot["animation"] {
  const pose = spitAnimation(target);
  return releasesRemaining === undefined
    ? pose
    : { ...pose, releasesRemaining };
}
