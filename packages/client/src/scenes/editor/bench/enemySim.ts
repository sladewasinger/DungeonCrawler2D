// Drives bench enemies with production AI and movement while ranged decisions launch
// an engine-ballistic projectile for the shared entity renderer to present.
import { createBody, enemyThink, faceEntity, makeEntity, newBrain, stepBody, type EffectEvent, type EffectTarget, type EnemyDef } from "@dc2d/engine";
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import { launchBenchSpit } from "./projectiles.js";
import type { BenchEnemy, BenchState } from "./state.js";

/** Keeps bench enemies within the painted grid, whose out-of-bounds cells are walkable void. */
function clampToGrid(value: number): number {
  return Math.min(EDITOR_GRID_SIZE - 0.01, Math.max(0.01, value));
}

export function spawnBenchEnemy(state: BenchState, defId: string, x: number, y: number, id: string): void {
  const def = state.content.enemies.get(defId);
  if (!def) return;
  const entity = makeEntity("enemy", createBody(x + 0.5, y + 0.5, 0), {
    id,
    defId,
    name: def.name,
    hp: def.hp,
    maxHp: def.hp,
    baseSpeed: def.speed,
    tags: new Set(def.tags),
  });
  state.enemies.set(id, { entity, def, brain: newBrain() });
}

function effectTargetFor(def: EnemyDef): EffectTarget {
  return {
    ...(def.immunities ? { immunities: def.immunities } : {}),
    ...(def.damageScale ? { damageScale: def.damageScale } : {}),
  };
}

/** Resolves a melee strike against the dummy; ranged attacks resolve in projectiles.ts. */
function resolveHit(state: BenchState, enemy: BenchEnemy, events: EffectEvent[]): void {
  const dummy = state.dummy;
  if (dummy.hp <= 0) return;
  const distance = Math.hypot(dummy.body.x - enemy.entity.body.x, dummy.body.y - enemy.entity.body.y);
  if (distance > enemy.def.attack.range + 0.3) return;
  faceEntity(enemy.entity, dummy.body.x - enemy.entity.body.x, dummy.body.y - enemy.entity.body.y);
  state.effects.modifyHealth(dummy, -enemy.def.attack.damage, events, { sourceTags: enemy.def.tags }, {});
  for (const apply of enemy.def.attack.applies ?? []) {
    if (state.rng.next() < apply.chance) state.effects.applyStatus(dummy, apply.status, events, {});
  }
}

function moveEnemy(state: BenchState, enemy: BenchEnemy, move: { moveX: number; moveY: number; jump: boolean }, dt: number): void {
  faceEntity(enemy.entity, move.moveX, move.moveY);
  stepBody(state.world, enemy.entity.body, move, dt, {
    speed: enemy.entity.baseSpeed * state.effects.speedMult(enemy.entity),
    blocked: (x, y) => state.world.isSanctuary(x, y),
  });
  enemy.entity.body.x = clampToGrid(enemy.entity.body.x);
  enemy.entity.body.y = clampToGrid(enemy.entity.body.y);
}

/** Advances each enemy once: an AI decision can move, strike, or launch a visible spit. */
export function tickEnemyAi(state: BenchState, dt: number, events: EffectEvent[]): void {
  for (const enemy of state.enemies.values()) {
    if (enemy.entity.hp <= 0) continue;
    const decision = enemyThink(enemy.brain, enemy.entity, enemy.def, [state.dummy], () => false, dt, () => state.rng.next());
    if (decision.shoot) {
      launchBenchSpit(state, enemy, decision.shoot);
      continue;
    }
    if (decision.strike) {
      resolveHit(state, enemy, events);
      continue;
    }
    moveEnemy(state, enemy, decision.move, dt);
  }
}

export { effectTargetFor };
