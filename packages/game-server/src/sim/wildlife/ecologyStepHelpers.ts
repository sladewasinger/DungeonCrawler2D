/** Per-tick AI pathfind budget, far-AI 5 Hz hibernation, water state, and swept projectile prop helpers. */
import { GroundKind, WorldChunkCache, worldToChunkCoord, type ChunkProp, type WorldEvent } from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { stepWildlifeEntity } from "./creatureAi.js";
import type { CombatPlayerCandidate, EcologyFoodSource } from "./creatureBehaviors.js";
import { ST_IDLE, ST_PATROL, type WildlifeEntity } from "./creatureSpecs.js";
import type { CombatTarget } from "./factionTargeting.js";

/** Runs all active non-hibernated wildlife entities under the shared per-tick A* budget. */
export function runEcologyEntityLoop(opts: {
  readonly cache: WorldChunkCache; readonly list: WildlifeEntity[];
  readonly players: readonly (CombatPlayerRef & { readonly moving: boolean })[];
  readonly foods: readonly EcologyFoodSource[]; readonly scent: Parameters<typeof stepWildlifeEntity>[0]["scent"];
  readonly events: WorldEvent[]; readonly stepCount: number; readonly timeSec: number; readonly dayPhase: number; readonly dt: number;
  readonly onConsumeFood: (food: EcologyFoodSource) => void;
  readonly onStrike: (att: WildlifeEntity, target: CombatTarget) => void;
  readonly onBurnKill: (e: WildlifeEntity) => void;
  readonly spawnWeb?: ((s: WildlifeEntity, t: CombatTarget) => void) | undefined;
}): void {
  resetPathfindTickBudget();
  try {
    for (let i = opts.list.length - 1; i >= 0; i--) {
      const e = opts.list[i]!;
      const stepDt = resolveHibernationDt({ e, players: opts.players, stepCount: opts.stepCount, index: i, dt: opts.dt });
      if (stepDt === null) continue;
      const keep = stepWildlifeEntity({
        cache: opts.cache, e, allEntities: opts.list, players: opts.players, foods: opts.foods, onConsumeFood: opts.onConsumeFood,
        scent: opts.scent, events: opts.events, timeSec: opts.timeSec, dayPhase: opts.dayPhase, dt: stepDt,
        onStrike: opts.onStrike, onBurnKill: opts.onBurnKill, spawnWeb: opts.spawnWeb,
      });
      if (!keep) opts.list.splice(i, 1);
    }
  } finally { resetPathfindTickBudget(null); }
}

const MAX_PATHFINDS_PER_TICK = 12;
const HIBERNATE_DIST_TILES = 36;

let pathfindBudgetRemaining: number | null = null;

/** Resets per-tick A* pathfind quota (`null` leaves standalone test calls uncapped). */
function resetPathfindTickBudget(limit: number | null = MAX_PATHFINDS_PER_TICK): void {
  pathfindBudgetRemaining = limit;
}

/** Consumes one A* pathfind slot if the per-tick quota allows. */
export function tryConsumePathfindBudget(): boolean {
  if (pathfindBudgetRemaining === null) return true;
  if (pathfindBudgetRemaining <= 0) return false;
  pathfindBudgetRemaining -= 1;
  return true;
}

/** Prunes far wildlife beyond 96 tiles and forgets their spawn chunk so they can respawn on return. */
export function pruneDistantWildlife(
  list: WildlifeEntity[],
  spawnedChunks: Set<string>,
  players: readonly CombatPlayerCandidate[],
): void {
  if (players.length === 0) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]!;
    if (players.some((p) => Math.hypot(p.x - e.x, p.y - e.y) <= 96)) continue;
    list.splice(i, 1);
    spawnedChunks.delete(`${worldToChunkCoord(Math.floor(e.homeX))},${worldToChunkCoord(Math.floor(e.homeY))}`);
  }
}

function hasNoActiveStatusTimers(e: WildlifeEntity): boolean {
  return e.hitTimer <= 0 && e.alertedTimer <= 0 && e.provokedTimer <= 0 && e.bleedTimer <= 0
    && e.burnTimer <= 0 && e.poisonTimer <= 0 && e.staggerTimer <= 0 && e.stunnedTimer <= 0;
}

function isIdleHibernatable(e: WildlifeEntity): boolean {
  const idle = !e.corpse && (e.aiState === ST_IDLE || e.aiState === ST_PATROL) && e.investigateTimer <= 0;
  return idle && hasNoActiveStatusTimers(e);
}

/** Returns step dt (`dt * 4` at 5 Hz when idling far from all players, or `null` on skipped ticks). */
function resolveHibernationDt(opts: {
  readonly e: WildlifeEntity;
  readonly players: readonly CombatPlayerCandidate[];
  readonly stepCount: number;
  readonly index: number;
  readonly dt: number;
}): number | null {
  const { e, players, stepCount, index, dt } = opts;
  if (players.length === 0 || !isIdleHibernatable(e)) return dt;
  const maxSq = HIBERNATE_DIST_TILES * HIBERNATE_DIST_TILES;
  if (players.some((p) => (p.x - e.x) ** 2 + (p.y - e.y) ** 2 <= maxSq)) return dt;
  return (stepCount + index) % 4 === 0 ? dt * 4 : null;
}

/** Syncs a creature's shallow/deep water flags from the underlying ground tile. */
export function syncWaterState(cache: WorldChunkCache, e: WildlifeEntity): void {
  const ground = cache.tileAt(Math.floor(e.x), Math.floor(e.y)).ground;
  e.inDeepWater = ground === GroundKind.DeepWater;
  e.inWater = e.inDeepWater || ground === GroundKind.ShallowWater;
}

/** Collects props only from chunks overlapped by a swept projectile segment. */
export function collectSegmentProps(opts: {
  readonly cache: WorldChunkCache;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}): readonly ChunkProp[] {
  const { cache, x0, y0, x1, y1 } = opts;
  if (cache.propsNear !== WorldChunkCache.prototype.propsNear) return cache.propsNear(x1, y1);
  const pad = 1.0;
  const minCx = worldToChunkCoord(Math.floor(Math.min(x0, x1) - pad));
  const maxCx = worldToChunkCoord(Math.floor(Math.max(x0, x1) + pad));
  const minCy = worldToChunkCoord(Math.floor(Math.min(y0, y1) - pad));
  const maxCy = worldToChunkCoord(Math.floor(Math.max(y0, y1) + pad));
  const out: ChunkProp[] = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) out.push(...cache.getChunk(cx, cy).props);
  }
  return out;
}
