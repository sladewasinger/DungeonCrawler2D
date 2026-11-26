/** Pure spatial audio probe helpers and event-to-gore builders for WorldScene. */
import {
  GroundKind, WorldChunkCache,
  type PlayerSnapshot, type PointLightSpec, type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";

export interface SceneAudioDistances {
  readonly campfireDist: number;
  readonly waterDist: number;
}

const WATER_PROBE_RING: readonly (readonly [number, number])[] = [
  [-2, 0], [2, 0], [0, -2], [0, 2], [-4, -4], [0, -4], [4, -4],
  [-4, 0], [4, 0], [-4, 4], [0, 4], [4, 4], [-6, 0], [6, 0], [0, -6], [0, 6],
];

export function nearestCampfireDist(campfires: readonly PointLightSpec[], local: PlayerSnapshot | undefined): number {
  if (!local || campfires.length === 0) return 99;
  let best = 99;
  for (const fire of campfires) {
    const d = Math.hypot(fire.x - local.x, fire.y - local.y);
    if (d < best) best = d;
  }
  return best;
}

export function nearestWaterDist(cache: WorldChunkCache, local: PlayerSnapshot | undefined): number {
  if (!local) return 99;
  if (local.inWater) return 0;
  const cx = Math.floor(local.x);
  const cy = Math.floor(local.y);
  let best = 99;
  for (const [dx, dy] of WATER_PROBE_RING) {
    const g = cache.tileAt(cx + dx, cy + dy).ground;
    if (g === GroundKind.ShallowWater || g === GroundKind.DeepWater) {
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}

export function resolveEventElev(
  id: string | undefined,
  entities: readonly WorldEntitySnapshot[] | undefined,
  local: PlayerSnapshot | undefined,
): number {
  const match = id ? entities?.find((e) => e.id === id) : undefined;
  return match?.elevation ?? local?.elevation ?? 0;
}

export function buildGoreSpawn(ev: WorldEvent, elevation: number, cache?: WorldChunkCache) {
  return {
    x: ev.x, y: ev.y, elevation,
    dirX: ev.dirX ?? 0, dirY: ev.dirY ?? 1,
    style: ev.goreStyle!, substance: ev.substance!,
    fatal: ev.fatal, comboStep: ev.comboStep, sweepDir: ev.sweepDir, cache,
  };
}


interface EntityWaterSample {
  readonly x: number; readonly y: number; readonly hp: number;
  readonly inWater?: boolean | undefined; readonly inDeepWater?: boolean | undefined; readonly corpse?: boolean | undefined;
}

const isLiveInWater = (e: EntityWaterSample): boolean => !e.corpse && e.hp > 0 && Boolean(e.inWater || e.inDeepWater);

export function collectWaterActors(
  players: readonly PlayerSnapshot[],
  entities: readonly EntityWaterSample[],
): readonly { readonly x: number; readonly y: number; readonly moving: boolean; readonly deep: boolean }[] {
  const pList = players
    .filter((p) => p.inWater || p.inDeepWater)
    .map((p) => ({ x: p.x, y: p.y, moving: p.moving, deep: Boolean(p.inDeepWater) }));
  const eList = entities
    .filter(isLiveInWater)
    .map((e) => ({ x: e.x, y: e.y, moving: true, deep: Boolean(e.inDeepWater) }));
  return [...pList, ...eList];
}

function appendPlayerEmitter(
  p: PlayerSnapshot,
  out: { burning: { x: number; y: number }[]; cover: { x: number; y: number }[] },
): void {
  if ((p.burnTimer ?? 0) > 0) out.burning.push({ x: p.x, y: p.y });
  if (p.inCover && p.moving) out.cover.push({ x: p.x, y: p.y });
}

export function collectActorParticleEmitters(
  players: readonly PlayerSnapshot[],
  entities: readonly WorldEntitySnapshot[],
): {
  readonly burningActors: readonly { readonly x: number; readonly y: number }[];
  readonly coverActors: readonly { readonly x: number; readonly y: number }[];
} {
  const out = { burning: [] as { x: number; y: number }[], cover: [] as { x: number; y: number }[] };
  for (const p of players) appendPlayerEmitter(p, out);
  for (const e of entities) {
    if (e.burning && e.hp > 0 && !e.corpse) out.burning.push({ x: e.x, y: e.y });
  }
  return { burningActors: out.burning, coverActors: out.cover };
}

export interface SparkBurstPos {
  readonly x: number; readonly y: number; readonly dirX: number; readonly dirY: number; readonly elev: number;
}

export interface SceneFxSinks {
  readonly spawnSmoke: (x: number, y: number, dur?: number) => void;
  readonly spawnSparks: (pos: SparkBurstPos) => void;
  readonly spawnCritSparks: (pos: SparkBurstPos) => void;
  readonly spawnCrack: (x: number, y: number, elev: number) => void;
  readonly spawnGore: (ev: WorldEvent, elev: number) => void;
}

const SHAKE_EVENT_KINDS = new Set<WorldEvent["kind"]>(["hit", "backstab", "riposte", "guardBreak", "slamImpact", "parry"]);
const CRIT_SPARK_KINDS = new Set<WorldEvent["kind"]>(["backstab", "riposte", "guardBreak"]);

function emitHitGoreAndSparks(ev: WorldEvent, sparkPos: SparkBurstPos, sinks: SceneFxSinks): void {
  if (!ev.goreStyle || !ev.substance) return;
  sinks.spawnGore(ev, sparkPos.elev);
  if (ev.substance === "stone") sinks.spawnSparks(sparkPos);
}

function emitSimpleVisual(opts: { readonly ev: WorldEvent; readonly sparkPos: SparkBurstPos; readonly leaveSmokeDur: number; readonly sinks: SceneFxSinks }): boolean {
  const { ev, sparkPos, leaveSmokeDur, sinks } = opts;
  if (ev.kind === "playerLeave") { sinks.spawnSmoke(ev.x, ev.y, leaveSmokeDur); return true; }
  if (ev.kind === "burnExtinguish") { sinks.spawnSmoke(ev.x, ev.y, 1.0); return true; }
  if (ev.kind === "arrowRicochet") { sinks.spawnSparks(sparkPos); return true; }
  return false;
}

function emitWorldEventVisuals(opts: {
  readonly ev: WorldEvent; readonly elev: number; readonly localElev: number;
  readonly leaveSmokeDur: number; readonly sinks: SceneFxSinks;
}): void {
  const { ev, elev, localElev, sinks } = opts;
  const sparkPos: SparkBurstPos = { x: ev.x, y: ev.y, dirX: ev.dirX ?? 0, dirY: ev.dirY ?? 1, elev };
  if (emitSimpleVisual({ ev, sparkPos: { ...sparkPos, elev: localElev }, leaveSmokeDur: opts.leaveSmokeDur, sinks })) return;
  if (ev.kind === "slamImpact") sinks.spawnCrack(ev.x, ev.y, localElev);
  if (CRIT_SPARK_KINDS.has(ev.kind)) sinks.spawnCritSparks(sparkPos);
  if (ev.kind === "hit") emitHitGoreAndSparks(ev, sparkPos, sinks);
}

function resolveEventShake(ev: WorldEvent, localId: string): number {
  const involved = ev.actorId === localId || ev.targetId === localId;
  if (!involved || !SHAKE_EVENT_KINDS.has(ev.kind)) return 0;
  if (ev.shakePx !== undefined) return ev.shakePx;
  if (ev.targetId !== localId) return 0;
  return ev.fatal ? 5.5 : 3.2;
}

export function applyWorldEventFx(opts: {
  readonly ev: WorldEvent; readonly localId: string;
  readonly entities: readonly WorldEntitySnapshot[] | undefined; readonly local: PlayerSnapshot | undefined;
  readonly leaveSmokeDur: number; readonly sinks: SceneFxSinks;
}): number {
  const { ev, localId, entities, local, sinks } = opts;
  const elev = resolveEventElev(ev.targetId, entities, local);
  emitWorldEventVisuals({ ev, elev, localElev: local?.elevation ?? 0, leaveSmokeDur: opts.leaveSmokeDur, sinks });
  return resolveEventShake(ev, localId);
}

export function buildSceneFxSinks(opts: {
  readonly particles: { spawnSmokePoof(q: { readonly x: number; readonly y: number; readonly durationSec?: number }): void };
  readonly gore: {
    spawnClashSparks(q: { readonly x: number; readonly y: number; readonly dirX: number; readonly dirY: number; readonly elevation: number }): void;
    spawnCritSparks(q: { readonly x: number; readonly y: number; readonly dirX: number; readonly dirY: number; readonly elevation: number }): void;
    spawnGroundCrack(q: { readonly x: number; readonly y: number; readonly elevation: number; readonly cache: WorldChunkCache }): void;
    spawn(q: ReturnType<typeof buildGoreSpawn>): void;
  };
  readonly cache: WorldChunkCache;
}): SceneFxSinks {
  const { particles, gore, cache } = opts;
  return {
    spawnSmoke: (x, y, durationSec) => particles.spawnSmokePoof(durationSec !== undefined ? { x, y, durationSec } : { x, y }),
    spawnSparks: (pos) => gore.spawnClashSparks({ x: pos.x, y: pos.y, dirX: pos.dirX, dirY: pos.dirY, elevation: pos.elev }),
    spawnCritSparks: (pos) => gore.spawnCritSparks({ x: pos.x, y: pos.y, dirX: pos.dirX, dirY: pos.dirY, elevation: pos.elev }),
    spawnCrack: (x, y, elevation) => gore.spawnGroundCrack({ x, y, elevation, cache }),
    spawnGore: (ev, elev) => gore.spawn(buildGoreSpawn(ev, elev, cache)),
  };
}

export function applyWorldEventsBatch(opts: {
  readonly events: readonly WorldEvent[];
  readonly localId: string;
  readonly entities: readonly WorldEntitySnapshot[] | undefined;
  readonly local: PlayerSnapshot | undefined;
  readonly leaveSmokeDur: number;
  readonly sinks: SceneFxSinks;
}): number {
  let maxShake = 0;
  for (const ev of opts.events) {
    const shake = applyWorldEventFx({
      ev, localId: opts.localId, entities: opts.entities, local: opts.local,
      leaveSmokeDur: opts.leaveSmokeDur, sinks: opts.sinks,
    });
    if (shake > maxShake) maxShake = shake;
  }
  return maxShake;
}

export function bindViewportRectSync(target: HTMLElement, onSync: () => void): () => void {
  onSync();
  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(onSync) : null;
  obs?.observe(target);
  window.addEventListener("resize", onSync, { passive: true });
  window.addEventListener("scroll", onSync, { passive: true, capture: true });
  window.addEventListener("fullscreenchange", onSync, { passive: true });
  return () => {
    obs?.disconnect();
    window.removeEventListener("resize", onSync);
    window.removeEventListener("scroll", onSync, true);
    window.removeEventListener("fullscreenchange", onSync);
  };
}
