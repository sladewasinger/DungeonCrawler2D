import {
  applyKnockback,
  createBody,
  faceEntity,
  KNOCKBACK_FORCE,
  launchVelocity,
  makeEntity,
  newEntityId,
  THROW_SPEED,
  type EffectEvent,
} from "@dc2d/engine";
import { effectTargetFor } from "../../core/helpers.js";
import { blocksAttackFrom } from "../../players/directionalBlock.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

export interface EnemyStrikeInput {
  sim: SimState;
  enemy: EnemySlot;
  targetId: string;
  effectEvents: EffectEvent[];
  attackTicks: number;
}

export interface SpitLaunchInput {
  sim: SimState;
  entity: EnemySlot["entity"];
  tags: readonly string[];
  target: { x: number; y: number; z: number };
}

export function resolveEnemyStrike(input: EnemyStrikeInput): void {
  const { sim, enemy, targetId, attackTicks } = input;
  const victimSlot = sim.players.get(targetId);
  const victim = victimSlot?.entity;
  if (!victim || victim.hp <= 0) return;
  faceEntity(enemy.entity, victim.body.x - enemy.entity.body.x, victim.body.y - enemy.entity.body.y);
  if (isOutOfStrikeRange(enemy, victim)) return;
  enemy.animation = { state: "attack", ticksRemaining: attackTicks };
  if (blocksAttackFrom(victimSlot, enemy.entity)) return;
  applyStrikeEffects(input, victim);
  applyKnockback(victim.body, {
    dirX: victim.body.x - enemy.entity.body.x,
    dirY: victim.body.y - enemy.entity.body.y,
    force: KNOCKBACK_FORCE * 0.6,
  });
}

function isOutOfStrikeRange(enemy: EnemySlot, victim: EnemySlot["entity"]): boolean {
  const { body } = enemy.entity;
  const tooFar = Math.hypot(
    victim.body.x - body.x,
    victim.body.y - body.y,
  ) > enemy.def.attack.range + 0.3;
  const tooHigh = Math.abs(victim.body.z - body.z) >
    ENEMY_SIMULATION_TUNING.perception.maximumMeleeHeightDifference;
  return tooFar || tooHigh;
}

function applyStrikeEffects(input: EnemyStrikeInput, victim: EnemySlot["entity"]): void {
  const { sim, enemy, effectEvents } = input;
  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth({
    entity: victim,
    amount: -enemy.def.attack.damage,
    events: effectEvents,
    opts: { sourceTags: enemy.def.tags, sourceId: enemy.entity.id },
    target,
  });
  for (const apply of enemy.def.attack.applies ?? []) {
    if (sim.rng.next() < apply.chance) {
      sim.effects.applyStatus({
        entity: victim,
        statusId: apply.status,
        events: effectEvents,
        target,
        sourceId: enemy.entity.id,
      });
    }
  }
}

export function launchSpit(input: SpitLaunchInput): void {
  const { sim, entity, tags, target } = input;
  const projectile = makeEntity("projectile", createBody(entity.body.x, entity.body.y, entity.body.z + 0.5), {
    id: newEntityId("j"),
    ownerId: entity.id,
    tags: new Set(["spit", ...tags]),
    vel: launchVelocity({ x: entity.body.x, y: entity.body.y, z: entity.body.z + 0.5 }, target, THROW_SPEED),
  });
  sim.projectiles.set(projectile.id, projectile);
}
