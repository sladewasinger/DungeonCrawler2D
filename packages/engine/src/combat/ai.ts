import type { EnemyDef } from "../effects/types.js";
import type { Entity } from "../entities/entity.js";
import type { MoveInput } from "../entities/movement/index.js";

/**
 * Enemy decision-making: pure functions the server drives each tick.
 * Wander until a living, non-sanctuary player enters aggro range, then
 * chase and attack. Enemies can be kited — into fire, off cliffs, or
 * onto strangers; the aggro rule is simply "nearest visible player".
 */

export interface EnemyBrain {
  targetId: string | null;
  wanderDir: MoveInput;
  wanderLeft: number;
  attackCooldown: number;
}

export interface EnemyDecision {
  move: MoveInput;
  /** Melee strike this tick. */
  strike?: { targetId: string };
  /** Launch a ranged projectile at this position/entity. */
  shoot?: { targetId: string; x: number; y: number; z: number };
}

export function newBrain(): EnemyBrain {
  return {
    targetId: null,
    wanderDir: { moveX: 0, moveY: 0, jump: false },
    wanderLeft: 0,
    attackCooldown: 0,
  };
}

const AXIS: readonly [-1, 0, 1] = [-1, 0, 1];

function pickAxis(rng: () => number): -1 | 0 | 1 {
  return AXIS[Math.floor(rng() * 3)] ?? 0;
}

interface AggroSearch {
  enemy: Entity;
  def: EnemyDef;
  players: readonly Entity[];
  inSanctuary: (entity: Entity) => boolean;
}

interface EnemyThinkInput extends AggroSearch {
  brain: EnemyBrain;
  dt: number;
  rng: () => number;
}

interface AttackInput {
  brain: EnemyBrain;
  enemy: Entity;
  def: EnemyDef;
  target: Entity;
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

function wander(brain: EnemyBrain, dt: number, rng: () => number): EnemyDecision {
  brain.wanderLeft -= dt;
  if (brain.wanderLeft <= 0) {
    brain.wanderLeft = 1 + rng() * 2;
    brain.wanderDir = { moveX: pickAxis(rng), moveY: pickAxis(rng), jump: false };
  }
  return { move: brain.wanderDir };
}

function attackOrChase({ brain, enemy, def, target }: AttackInput): EnemyDecision {
  const dx = target.body.x - enemy.body.x;
  const dy = target.body.y - enemy.body.y;
  const dist = Math.hypot(dx, dy);
  const attack = tryAttack({ brain, def, target, dist });
  if (attack) return attack;
  if (shouldHoldRangedPosition(def, dist)) return { move: idleMove() };
  return { move: chaseMove(dx, dy) };
}

function tryAttack({ brain, def, target, dist }: Omit<AttackInput, "enemy"> & { dist: number }): EnemyDecision | null {
  if (dist > def.attack.range || brain.attackCooldown > 0) return null;
  brain.attackCooldown = def.attack.cooldown;
  if (!def.attack.ranged) return { move: idleMove(), strike: { targetId: target.id } };
  return { move: idleMove(), shoot: { targetId: target.id, ...target.body } };
}

function shouldHoldRangedPosition(def: EnemyDef, distance: number): boolean {
  return Boolean(def.attack.ranged) && distance <= def.attack.range * 0.7;
}

function idleMove(): MoveInput {
  return { moveX: 0, moveY: 0, jump: false };
}

function chaseMove(dx: number, dy: number): MoveInput {
  return {
    moveX: Math.abs(dx) > 0.3 ? (Math.sign(dx) as -1 | 0 | 1) : 0,
    moveY: Math.abs(dy) > 0.3 ? (Math.sign(dy) as -1 | 0 | 1) : 0,
    jump: false,
  };
}

export function enemyThink({ brain, enemy, def, players, inSanctuary, dt, rng }: EnemyThinkInput): EnemyDecision {
  brain.attackCooldown = Math.max(0, brain.attackCooldown - dt);

  const target = findAggroTarget({ enemy, def, players, inSanctuary });
  brain.targetId = target?.id ?? null;

  if (!target) return wander(brain, dt, rng);
  return attackOrChase({ brain, enemy, def, target });
}
