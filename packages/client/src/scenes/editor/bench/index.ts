// Bench facade (Epic 7.11): the SIMULATE tick order lives here, top to bottom — the
// same shape as game-server's GameSim.step(), just for the local painted canvas, with
// no network involved (Assumption #26). Consumers (editorStore, EditorScene, the paint
// panel) import only this file, never the sibling modules directly.
import { TICK_DT, TICK_RATE, type EffectEvent } from "@dc2d/engine";
import type { EditableWorld } from "../EditableWorld.js";
import { tickDummyRegen } from "./dummy.js";
import { effectTargetFor, tickEnemyAi } from "./enemySim.js";
import { createBenchState, type BenchState } from "./state.js";

export { AREA_BRUSHES, ENEMY_BRUSH_IDS, GROUND_ITEM_BRUSH_ID, enemyDef } from "./content.js";
export { eraseBenchCell, paintArea, paintEnemy, paintItem, resetBench, type BenchLayer } from "./paint.js";
export { benchAreaTileViews, benchItemViews, benchMonsterViews } from "./views.js";
export type { BenchEnemy, BenchItemSpawn, BenchState } from "./state.js";

export function createBench(world: EditableWorld): BenchState {
  return createBenchState(world);
}

/** Ground-contact statuses: standing on a status-tagged area tile catches it — mirrors
 * game-server statuses.ts's applyGroundStatuses. Bench entities are always grounded
 * (no jump/flight modeled here), so every live combatant is eligible every tick. */
function applyGroundContact(state: BenchState, events: EffectEvent[]): void {
  const combatants = [...state.enemies.values()].map((e) => e.entity).concat(state.dummy);
  for (const entity of combatants) {
    if (entity.hp <= 0) continue;
    const defId = state.areas.defAt(Math.floor(entity.body.x), Math.floor(entity.body.y));
    const area = defId ? state.content.areas.get(defId) : undefined;
    if (area?.onEnterStatus) state.effects.applyStatus(entity, area.onEnterStatus, events, {});
  }
}

function tickStatusesAndRules(state: BenchState, events: EffectEvent[]): void {
  const rng = () => state.rng.next();
  for (const enemy of state.enemies.values()) {
    if (enemy.entity.hp <= 0) continue;
    state.effects.tick(enemy.entity, TICK_DT, events, effectTargetFor(enemy.def), rng);
    state.effects.runInteractionRules(enemy.entity, events);
  }
  state.effects.tick(state.dummy, TICK_DT, events, {}, rng);
  state.effects.runInteractionRules(state.dummy, events);
}

/** Turn engine effect events into bench world changes — mirrors statuses.ts's
 * realizeEffectEvents, minus the wire-event/HUD plumbing this bench has no use for. */
function realizeEvents(state: BenchState, events: readonly EffectEvent[]): void {
  for (const event of events) {
    if (event.t === "spawnArea") state.areas.spawn(event.area, event.x, event.y, event.radius);
  }
}

function reapDeadEnemies(state: BenchState): void {
  for (const [id, enemy] of state.enemies) if (enemy.entity.hp <= 0) state.enemies.delete(id);
}

/** One fixed tick at the server's TICK_RATE: areas → ground contact → statuses/rules →
 * realize → AI → dummy regen → reap. Read top-to-bottom, per ENGINEERING_STANDARDS.md. */
export function stepBenchTick(state: BenchState): void {
  state.tickCount++;
  const events: EffectEvent[] = [];
  state.areas.tick(TICK_DT, () => state.rng.next());
  applyGroundContact(state, events);
  tickStatusesAndRules(state, events);
  realizeEvents(state, events);
  tickEnemyAi(state, TICK_DT, events);
  tickDummyRegen(state.dummy, TICK_DT);
  reapDeadEnemies(state);
}

const STEP_MS = 1000 / TICK_RATE;

/** Fixed-timestep accumulator: call once per render frame with elapsed ms. No-op while
 * paused, so toggling SIMULATE off freezes every painted tile/entity exactly in place. */
export function advanceBench(state: BenchState, deltaMs: number): void {
  if (!state.running) return;
  state.tickAccumMs += deltaMs;
  while (state.tickAccumMs >= STEP_MS) {
    state.tickAccumMs -= STEP_MS;
    stepBenchTick(state);
  }
}

export function toggleSimulate(state: BenchState): void {
  state.running = !state.running;
}
