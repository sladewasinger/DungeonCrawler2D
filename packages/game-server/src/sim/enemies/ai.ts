import { enemyThink, faceEntity, TICK_DT, ENEMY_ACTIVE_RADIUS, type EffectEvent } from "@dc2d/engine";
import { isBodyInChasm } from "../helpers.js";
import { gracedClearanceCenters, isSpawnProtected } from "../spawnSafety.js";
import type { EnemySlot, PlayerSlot, SimState } from "../state.js";
import { revalidateEnemyTarget } from "./targetLifecycle.js";
import { launchSpit, moveEnemy, resolveEnemyStrike } from "./ai/combat.js";

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

function enemyPlayerSets(sim: SimState): {
  activePlayers: EnemySlot["entity"][];
  targetablePlayers: EnemySlot["entity"][];
} {
  const activePlayers: EnemySlot["entity"][] = [];
  const targetablePlayers: EnemySlot["entity"][] = [];
  for (const slot of sim.players.values()) {
    addEnemyVisiblePlayer({ slot, sim, activePlayers, targetablePlayers });
  }
  return { activePlayers, targetablePlayers };
}

interface VisiblePlayerInput {
  slot: PlayerSlot;
  sim: SimState,
  activePlayers: EnemySlot["entity"][],
  targetablePlayers: EnemySlot["entity"][],
}

function addEnemyVisiblePlayer(input: VisiblePlayerInput): void {
  const { slot, sim, activePlayers, targetablePlayers } = input;
  if (!slot.connected || slot.entity.hp <= 0 || isSpawnProtected(slot, sim.tickCount)) return;
  activePlayers.push(slot.entity);
  if (slot.downedAtTick === null) targetablePlayers.push(slot.entity);
}

export function stepEnemies(sim: SimState, effectEvents: EffectEvent[]): void {
  const { activePlayers, targetablePlayers } = enemyPlayerSets(sim);
  // Panel round 4 (Grinder's drift-in leak): while a player is graced,
  // hostiles may not MOVE into their clearance radius — moveEnemy clamps
  // at the boundary. Computed once per tick, not per enemy.
  const graced = gracedClearanceCenters(sim);
  for (const enemy of sim.enemies.values()) {
    stepEnemy({ sim, enemy, activePlayers, targetablePlayers, graced, effectEvents });
  }
}

interface EnemyStepInput {
  sim: SimState;
  enemy: EnemySlot;
  activePlayers: EnemySlot["entity"][];
  targetablePlayers: EnemySlot["entity"][];
  graced: ReadonlyArray<{ x: number; y: number }>;
  effectEvents: EffectEvent[];
}

function stepEnemy(input: EnemyStepInput): void {
  const { sim, enemy, activePlayers } = input;
  sim.replicationMotion.set(enemy.entity.id, { x: 0, y: 0 });
  if (enemy.entity.hp <= 0 || !isNearAnyPlayer(enemy.entity, activePlayers)) return;
  revalidateEnemyTarget(sim, enemy);
  if (killEnemyInChasm(sim, enemy) || advanceAttackAnimation(sim, enemy)) return;
  executeEnemyDecision(input);
}

function killEnemyInChasm(sim: SimState, enemy: EnemySlot): boolean {
  if (!isBodyInChasm(sim.world, enemy.entity.body)) return false;
  enemy.entity.hp = 0;
  return true;
}

function executeEnemyDecision(input: EnemyStepInput): void {
  const { sim, enemy, targetablePlayers, graced, effectEvents } = input;
  const decision = enemyThink({
    brain: enemy.brain,
    enemy: enemy.entity,
    def: enemy.def,
    players: targetablePlayers,
    inSanctuary: (entity) => sim.effects.inSanctuary(entity),
    dt: TICK_DT,
    rng: () => sim.rng.next(),
  });
  if (decision.shoot) {
    beginWindup(enemy, decision.shoot);
    return;
  }
  moveEnemy({ sim, enemy, move: decision.move, graced });
  if (decision.strike) resolveEnemyStrike({ sim, enemy, targetId: decision.strike.targetId, effectEvents, attackTicks: MELEE_ATTACK_TICKS });
}

function beginWindup(enemy: EnemySlot, shoot: { targetId: string; x: number; y: number; z: number }): void {
  faceEntity(enemy.entity, shoot.x - enemy.entity.body.x, shoot.y - enemy.entity.body.y);
  enemy.animation = { state: "windup", ticksRemaining: SPITTER_WINDUP_TICKS, target: shoot };
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
  if (enemy.animation.state === "windup") return finishWindup(sim, enemy);
  enemy.animation = nextRangedAnimation(enemy);
  return true;
}

function finishWindup(sim: SimState, enemy: EnemySlot): boolean {
  const target = enemy.animation.target;
  if (target) launchSpit({ sim, entity: enemy.entity, tags: enemy.def.tags, target });
  enemy.animation = target
    ? { state: "spit", ticksRemaining: SPITTER_SPIT_TICKS, target }
    : { state: "spit", ticksRemaining: SPITTER_SPIT_TICKS };
  return true;
}

function nextRangedAnimation(enemy: EnemySlot): EnemySlot["animation"] {
  return enemy.animation.state === "spit"
    ? { state: "recover", ticksRemaining: SPITTER_RECOVER_TICKS }
    : { state: "idle", ticksRemaining: 0 };
}
