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

function findAggroTarget(
  enemy: Entity,
  def: EnemyDef,
  players: readonly Entity[],
  inSanctuary: (e: Entity) => boolean,
): Entity | null {
  let target: Entity | null = null;
  let bestDist = def.aggroRadius;
  for (const player of players) {
    if (player.hp <= 0 || player.downedUntil !== undefined) continue;
    if (inSanctuary(player)) continue;
    const d = Math.hypot(player.body.x - enemy.body.x, player.body.y - enemy.body.y);
    if (d <= bestDist) {
      bestDist = d;
      target = player;
    }
  }
  return target;
}

function wander(brain: EnemyBrain, dt: number, rng: () => number): EnemyDecision {
  brain.wanderLeft -= dt;
  if (brain.wanderLeft <= 0) {
    brain.wanderLeft = 1 + rng() * 2;
    brain.wanderDir = { moveX: pickAxis(rng), moveY: pickAxis(rng), jump: false };
  }
  return { move: brain.wanderDir };
}

function attackOrChase(
  brain: EnemyBrain,
  enemy: Entity,
  def: EnemyDef,
  target: Entity,
): EnemyDecision {
  const dx = target.body.x - enemy.body.x;
  const dy = target.body.y - enemy.body.y;
  const dist = Math.hypot(dx, dy);

  if (def.attack.ranged) {
    if (dist <= def.attack.range && brain.attackCooldown <= 0) {
      brain.attackCooldown = def.attack.cooldown;
      return {
        move: { moveX: 0, moveY: 0, jump: false },
        shoot: { targetId: target.id, x: target.body.x, y: target.body.y, z: target.body.z },
      };
    }
    // Keep some distance: advance only when out of range.
    if (dist <= def.attack.range * 0.7) return { move: { moveX: 0, moveY: 0, jump: false } };
  } else if (dist <= def.attack.range && brain.attackCooldown <= 0) {
    brain.attackCooldown = def.attack.cooldown;
    return { move: { moveX: 0, moveY: 0, jump: false }, strike: { targetId: target.id } };
  }

  // Chase: cardinal-ish pursuit through the shared movement physics —
  // enemies obey terrain like everyone else (cliffs, jumps excluded).
  return {
    move: {
      moveX: Math.abs(dx) > 0.3 ? (Math.sign(dx) as -1 | 0 | 1) : 0,
      moveY: Math.abs(dy) > 0.3 ? (Math.sign(dy) as -1 | 0 | 1) : 0,
      jump: false,
    },
  };
}

export function enemyThink(
  brain: EnemyBrain,
  enemy: Entity,
  def: EnemyDef,
  players: readonly Entity[],
  inSanctuary: (e: Entity) => boolean,
  dt: number,
  rng: () => number,
): EnemyDecision {
  brain.attackCooldown = Math.max(0, brain.attackCooldown - dt);

  const target = findAggroTarget(enemy, def, players, inSanctuary);
  brain.targetId = target?.id ?? null;

  if (!target) return wander(brain, dt, rng);
  return attackOrChase(brain, enemy, def, target);
}
