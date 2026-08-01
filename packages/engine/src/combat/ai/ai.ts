import type { EnemyDef } from "../../effects/types.js";
import type { Entity } from "../../entities/entity.js";
import { reachesHurtbox } from "../geometry/hurtboxes.js";
import {
  ageEnemyMemory,
  rememberEnemyTarget,
} from "./enemyMemory.js";
import {
  idleEnemyMove,
  investigateOrWander,
  pursueEnemyPoint,
} from "./enemyMovementDecision.js";
import type {
  AggroSearch,
  EnemyBrain,
  EnemyDecision,
} from "./types.js";

export function newBrain(): EnemyBrain {
  return {
    targetId: null,
    wanderDir: { moveX: 0, moveY: 0, jump: false },
    wanderLeft: 0,
    attackCooldown: 0,
    rememberedTarget: null,
    memorySecondsRemaining: 0,
    memoryPhase: "pursuing",
    memorySearchSecondsRemaining: 0,
  };
}

/** Records a cooldown only after the server accepts the attack action. */
export function commitEnemyAttack(
  brain: EnemyBrain,
  cooldownSeconds: number,
): void {
  brain.attackCooldown = Math.max(brain.attackCooldown, cooldownSeconds);
}

interface EnemyThinkInput extends AggroSearch {
  brain: EnemyBrain;
  dt: number;
  rng: () => number;
  memorySeconds?: number;
  memorySearchSeconds?: number;
  memoryArrivalTolerance?: number;
  maximumMeleeHeightDifference?: number;
}

interface AttackInput {
  brain: EnemyBrain;
  enemy: Entity;
  def: EnemyDef;
  target: Entity;
  maximumMeleeHeightDifference: number;
}

function findAggroTarget({ enemy, def, players, inSanctuary }: AggroSearch): Entity | null {
  let target: Entity | null = null;
  let bestDist = def.aggroRadius;
  for (const player of players) {
    const distance = eligibleAggroDistance({ enemy, player, inSanctuary });
    if (distance === null || distance > bestDist) continue;
    bestDist = distance;
    target = player;
  }
  return target;
}

function eligibleAggroDistance({ enemy, player, inSanctuary }: {
  enemy: Entity;
  player: Entity;
  inSanctuary: (entity: Entity) => boolean;
}): number | null {
  if (player.hp <= 0 || player.downedUntil !== undefined || inSanctuary(player)) return null;
  return Math.hypot(player.body.x - enemy.body.x, player.body.y - enemy.body.y);
}

function attackOrChase(input: AttackInput): EnemyDecision {
  const { enemy, def, target } = input;
  const dx = target.body.x - enemy.body.x;
  const dy = target.body.y - enemy.body.y;
  const dist = Math.hypot(dx, dy);
  const attack = tryAttack({ ...input, dist });
  if (attack) return attack;
  if (shouldHoldRangedPosition(def, dist)) {
    return { move: idleEnemyMove() };
  }
  return pursueEnemyPoint(enemy, target.body);
}

function tryAttack(
  input: AttackInput & { dist: number },
): EnemyDecision | null {
  const { brain, enemy, def, target, dist } = input;
  if (!canReachAttackTarget({ enemy, target, def, distance: dist }) ||
      brain.attackCooldown > 0) return null;
  if (!def.attack.ranged &&
      Math.abs(target.body.z - enemy.body.z) >
        input.maximumMeleeHeightDifference) return null;
  if (!def.attack.ranged) {
    return { move: idleEnemyMove(), strike: { targetId: target.id } };
  }
  return {
    move: idleEnemyMove(),
    shoot: { targetId: target.id, ...target.body },
  };
}

function canReachAttackTarget(input: {
  enemy: Entity;
  target: Entity;
  def: EnemyDef;
  distance: number;
}): boolean {
  if (input.def.attack.ranged) return input.distance <= input.def.attack.range;
  return reachesHurtbox(input.enemy, input.target, input.def.attack.range);
}

function shouldHoldRangedPosition(def: EnemyDef, distance: number): boolean {
  return Boolean(def.attack.ranged) && distance <= def.attack.range * 0.7;
}

export function enemyThink(input: EnemyThinkInput): EnemyDecision {
  const { brain, enemy, def, players, inSanctuary, dt, rng } = input;
  brain.attackCooldown = Math.max(0, brain.attackCooldown - dt);
  ageEnemyMemory(brain, dt);

  const target = findAggroTarget({ enemy, def, players, inSanctuary });
  brain.targetId = target?.id ?? null;

  if (!target) return investigateOrWander({
    brain,
    enemy,
    dt,
    rng,
    searchSeconds: input.memorySearchSeconds ?? 0,
    arrivalTolerance: input.memoryArrivalTolerance ?? 0.3,
  });
  rememberEnemyTarget(brain, target, input.memorySeconds ?? 0);
  return attackOrChase({
    brain,
    enemy,
    def,
    target,
    maximumMeleeHeightDifference:
      input.maximumMeleeHeightDifference ?? Infinity,
  });
}
