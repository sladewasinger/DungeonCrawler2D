// Live enemy driving for SIMULATE (Epic 7.11): reuses the engine's real AI decision
// function (enemyThink) and movement physics (stepBody) unchanged — the only divergence
// from the live game is that a ranged "spit" resolves as an instant hit on the dummy
// instead of a flying projectile entity, since the bench has exactly one stationary
// target and no projectile-rendering lane (Assumption #60).
import { createBody, enemyThink, faceEntity, makeEntity, newBrain, stepBody, type EffectEvent, type EffectTarget, type EnemyDef } from "@dc2d/engine";
import { EDITOR_GRID_SIZE } from "../EditableWorld.js";
import type { BenchEnemy, BenchState } from "./state.js";

/** Assumption #61: out-of-grid cells read as walkable void (EditableWorld's own
 * contract), so an unconstrained wanderer could drift off the painted canvas forever.
 * Clamping keeps every spawned enemy inside the 20x20 bench, matching how the paint
 * canvas — and the camera framing it — are bounded. */
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

/** Melee strike or resolved "spit" against the dummy — range-checked the same way the
 * live game's resolveStrike is, so a chase that falls short simply whiffs. */
function resolveHit(state: BenchState, enemy: BenchEnemy, events: EffectEvent[]): void {
  const dummy = state.dummy;
  if (dummy.hp <= 0) return;
  const d = Math.hypot(dummy.body.x - enemy.entity.body.x, dummy.body.y - enemy.entity.body.y);
  if (d > enemy.def.attack.range + 0.3) return;
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

/** One AI tick for every live enemy: think against the dummy as the sole "player", then
 * move, strike, or spit accordingly. */
export function tickEnemyAi(state: BenchState, dt: number, events: EffectEvent[]): void {
  for (const enemy of state.enemies.values()) {
    if (enemy.entity.hp <= 0) continue;
    const decision = enemyThink(enemy.brain, enemy.entity, enemy.def, [state.dummy], () => false, dt, () => state.rng.next());
    if (decision.shoot || decision.strike) {
      resolveHit(state, enemy, events);
      continue;
    }
    moveEnemy(state, enemy, decision.move, dt);
  }
}

export { effectTargetFor };
