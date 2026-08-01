import { faceEntity, type Entity } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../../configuration/enemySimulationTuning.js";

export function rangeReleaseTarget(
  sim: SimState,
  enemy: EnemySlot,
  target: EnemySlot["animation"]["target"],
): EnemySlot["animation"]["target"] {
  if (!target) return undefined;
  const player = rangedTargetEntity(sim, target);
  if (!player) return undefined;
  const includeSpread = shouldApplySpread(enemy);
  faceEnemyAtTarget(enemy, player);
  return rangedReleaseTargetBody({
    player,
    ...(target.spreadX !== undefined ? { spreadX: target.spreadX } : {}),
    ...(target.spreadY !== undefined ? { spreadY: target.spreadY } : {}),
    includeSpread,
  });
}

function shouldApplySpread(enemy: EnemySlot): boolean {
  return enemy.def.attack.elemental !== "directional-flame";
}

function faceEnemyAtTarget(enemy: EnemySlot, player: EnemySlot["entity"]): void {
  faceEntity(
    enemy.entity,
    player.body.x - enemy.entity.body.x,
    player.body.y - enemy.entity.body.y,
  );
}

function rangedTargetEntity(
  sim: SimState,
  target: EnemySlot["animation"]["target"],
): Entity | undefined {
  if (!target) return undefined;
  const player = sim.players.get(target.targetId)?.entity;
  return player && player.hp > 0 ? player : undefined;
}

function rangedReleaseTargetBody(input: {
  player: EnemySlot["entity"];
  spreadX?: number;
  spreadY?: number;
  includeSpread: boolean;
}): EnemySlot["animation"]["target"] {
  const offsetX = input.includeSpread && input.spreadX !== undefined
    ? input.spreadX
    : 0;
  const offsetY = input.includeSpread && input.spreadY !== undefined
    ? input.spreadY
    : 0;
  return {
    targetId: input.player.id,
    ...input.player.body,
    x: input.player.body.x + offsetX,
    y: input.player.body.y + offsetY,
  };
}

export function spitAnimation(
  target?: EnemySlot["animation"]["target"],
): EnemySlot["animation"] {
  const animation = {
    state: "spit" as const,
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedAttack,
  };
  return target ? { ...animation, target } : animation;
}
