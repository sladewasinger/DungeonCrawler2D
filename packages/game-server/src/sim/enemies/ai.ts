import {
  applyKnockback,
  createBody,
  enemyThink,
  faceEntity,
  KNOCKBACK_FORCE,
  launchVelocity,
  makeEntity,
  newEntityId,
  stepBody,
  THROW_SPEED,
  TICK_DT,
  ENEMY_ACTIVE_RADIUS,
  type EffectEvent,
} from "@dc2d/engine";
import { effectTargetFor, isBodyInChasm } from "../helpers.js";
import { gracedClearanceCenters, insideGracedClearance, isSpawnProtected } from "../spawnSafety.js";
import type { EnemySlot, SimState } from "../state.js";

/** Per-tick enemy AI: think, move/attack, and advance attack animations. */

const SPITTER_WINDUP_TICKS = 5;
const SPITTER_SPIT_TICKS = 2;
const SPITTER_RECOVER_TICKS = 3;
const MELEE_ATTACK_TICKS = 4;
const MELEE_RECOVER_TICKS = 3;

function isNearAnyPlayer(entity: EnemySlot["entity"], players: readonly EnemySlot["entity"][]): boolean {
  for (const p of players) {
    if (
      Math.abs(p.body.x - entity.body.x) < ENEMY_ACTIVE_RADIUS &&
      Math.abs(p.body.y - entity.body.y) < ENEMY_ACTIVE_RADIUS
    ) {
      return true;
    }
  }
  return false;
}

export function stepEnemies(sim: SimState, effectEvents: EffectEvent[]): void {
  const players = [...sim.players.values()]
    // Spawn-grace players are invisible to enemy aggro (spawnSafety.ts).
    .filter(
      (s) =>
        s.connected &&
        s.entity.hp > 0 &&
        s.downedAtTick === null &&
        !isSpawnProtected(s, sim.tickCount),
    )
    .map((s) => s.entity);
  // Panel round 4 (Grinder's drift-in leak): while a player is graced,
  // hostiles may not MOVE into their clearance radius — moveEnemy clamps
  // at the boundary. Computed once per tick, not per enemy.
  const graced = gracedClearanceCenters(sim);
  for (const enemy of sim.enemies.values()) {
    const entity = enemy.entity;
    if (entity.hp <= 0) continue; // corpses don't bite
    if (!isNearAnyPlayer(entity, players)) continue; // frozen far from everyone
    // Checked before the shoot/melee/wander dispatch, not only inside
    // moveEnemy's post-move check: a ranged decision below `continue`s
    // straight to beginWindup without ever calling moveEnemy, which
    // used to let a spitter parked in a rift (bad spawn, or chased/
    // knocked in) keep winding up and firing forever without this
    // ruling ever re-checking it.
    if (isBodyInChasm(entity.body)) {
      entity.hp = 0;
      continue;
    }
    if (advanceAttackAnimation(sim, enemy)) continue;

    const decision = enemyThink(
      enemy.brain,
      entity,
      enemy.def,
      players,
      (e) => sim.effects.inSanctuary(e),
      TICK_DT,
      () => sim.rng.next(),
    );
    if (decision.shoot) {
      beginWindup(enemy, decision.shoot);
      continue;
    }
    moveEnemy(sim, enemy, decision.move, graced);
    if (decision.strike) resolveStrike(sim, enemy, decision.strike.targetId, effectEvents);
  }
}

function beginWindup(enemy: EnemySlot, shoot: { x: number; y: number; z: number }): void {
  faceEntity(enemy.entity, shoot.x - enemy.entity.body.x, shoot.y - enemy.entity.body.y);
  enemy.animation = { state: "windup", ticksRemaining: SPITTER_WINDUP_TICKS, target: shoot };
}

function moveEnemy(
  sim: SimState,
  enemy: EnemySlot,
  move: { moveX: number; moveY: number; jump: boolean },
  graced: ReadonlyArray<{ x: number; y: number }>,
): void {
  const entity = enemy.entity;
  faceEntity(entity, move.moveX, move.moveY);
  const before = { ...entity.body };
  stepBody(sim.world, entity.body, move, TICK_DT, {
    speed: entity.baseSpeed * sim.effects.speedMult(entity),
    // Enemies never set foot on sanctuary ground.
    blocked: (x, y) => sim.world.isSanctuary(x, y),
  });
  // Panel round 4 (spawnSafety.ts guarantee 2): a hostile that was
  // outside a graced player's clearance radius may not end its step
  // inside one — revert the whole step, a deterministic clamp at the
  // boundary (it stalls; the next think can wander elsewhere). One
  // already inside is left to maintainSpawnClearance, which ran before
  // this step and will run again before it could ever act from inside.
  if (
    insideGracedClearance(graced, entity.body.x, entity.body.y) &&
    !insideGracedClearance(graced, before.x, before.y)
  ) {
    entity.body = before;
  }
  // Chasm = death applies to enemies too (same knockback-death-pit ruling
  // as players): resolveEnemyDeaths (deaths.ts) already removes any
  // hp<=0 enemy and rolls its drops, so this is the whole of it.
  if (isBodyInChasm(entity.body)) entity.hp = 0;
  enemy.animation = {
    state: move.moveX !== 0 || move.moveY !== 0 ? "walk" : "idle",
    ticksRemaining: 0,
  };
}

function resolveStrike(sim: SimState, enemy: EnemySlot, targetId: string, effectEvents: EffectEvent[]): void {
  const entity = enemy.entity;
  const victim = sim.players.get(targetId)?.entity;
  if (!victim || victim.hp <= 0) return;
  faceEntity(entity, victim.body.x - entity.body.x, victim.body.y - entity.body.y);
  const d = Math.hypot(victim.body.x - entity.body.x, victim.body.y - entity.body.y);
  if (d > enemy.def.attack.range + 0.3) return;

  const target = effectTargetFor(sim, victim);
  sim.effects.modifyHealth(victim, -enemy.def.attack.damage, effectEvents, { sourceTags: enemy.def.tags }, target);
  for (const apply of enemy.def.attack.applies ?? []) {
    if (sim.rng.next() < apply.chance) sim.effects.applyStatus(victim, apply.status, effectEvents, target);
  }
  applyKnockback(victim.body, victim.body.x - entity.body.x, victim.body.y - entity.body.y, KNOCKBACK_FORCE * 0.6);
  enemy.animation = { state: "attack", ticksRemaining: MELEE_ATTACK_TICKS };
}

/** Advance a windup/attack/recover pose. Returns true while the enemy
 * is committed to it (no movement or re-think this tick). */
function advanceAttackAnimation(sim: SimState, enemy: EnemySlot): boolean {
  if (enemy.animation.state === "attack") {
    return tickPose(enemy, () => ({ state: "recover", ticksRemaining: MELEE_RECOVER_TICKS }));
  }
  if (enemy.animation.state === "recover" && !enemy.def.attack.ranged) {
    return tickPose(enemy, () => ({ state: "idle", ticksRemaining: 0 }));
  }
  if (!enemy.def.attack.ranged || enemy.animation.state === "idle" || enemy.animation.state === "walk") {
    return false;
  }
  return advanceRangedPose(sim, enemy);
}

/** Decrement a pose's timer; on expiry, transition via `next`. */
function tickPose(enemy: EnemySlot, next: () => EnemySlot["animation"]): boolean {
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining <= 0) enemy.animation = next();
  return true;
}

/** Spitter windup → spit (launches the projectile) → recover → idle. */
function advanceRangedPose(sim: SimState, enemy: EnemySlot): boolean {
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining > 0) return true;
  if (enemy.animation.state === "windup") {
    const target = enemy.animation.target;
    if (target) {
      launchSpit(sim, enemy.entity, enemy.def.tags, target);
      enemy.animation = { state: "spit", ticksRemaining: SPITTER_SPIT_TICKS, target };
    } else {
      enemy.animation = { state: "spit", ticksRemaining: SPITTER_SPIT_TICKS };
    }
    return true;
  }
  if (enemy.animation.state === "spit") {
    enemy.animation = { state: "recover", ticksRemaining: SPITTER_RECOVER_TICKS };
    return true;
  }
  enemy.animation = { state: "idle", ticksRemaining: 0 };
  return true;
}

function launchSpit(
  sim: SimState,
  entity: EnemySlot["entity"],
  tags: readonly string[],
  target: { x: number; y: number; z: number },
): void {
  const projectile = makeEntity("projectile", createBody(entity.body.x, entity.body.y, entity.body.z + 0.5), {
    id: newEntityId("j"),
    ownerId: entity.id,
    tags: new Set(["spit", ...tags]),
    vel: launchVelocity({ x: entity.body.x, y: entity.body.y, z: entity.body.z + 0.5 }, target, THROW_SPEED),
  });
  sim.projectiles.set(projectile.id, projectile);
}
