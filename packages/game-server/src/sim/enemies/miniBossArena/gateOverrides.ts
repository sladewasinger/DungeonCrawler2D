import {
  FEATURE_FACE,
  TILE,
  miniBossArenaKey,
  miniBossArenaForChunk,
  type MiniBossArenaGateSnapshot,
  type TileFeatureOverride,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";
import { MINI_BOSS_ARENA_RUNTIME_CONFIGURATION as CONFIG } from "./configuration.js";
import { defeatedMiniBossArenaRevision } from "./defeatedArenaState.js";
import { chunksWithinTileRadius } from "./landmarks/nearbyChunks.js";
import { miniBossArenaEntries } from "./runtime.js";

export function miniBossArenaGateOverrides(
  sim: SimState,
): TileFeatureOverride[] {
  const gates = [
    ...temporaryOpenGates(sim),
    ...permanentlyOpenGates(sim),
  ];
  return uniqueGates(gates).map(openGateOverride);
}

export function miniBossArenaGatesForSlot(
  sim: SimState,
  slot: PlayerSlot,
): MiniBossArenaGateSnapshot[] {
  const body = slot.entity.body;
  const radius = CONFIG.openGateReplicationRadiusTiles;
  return uniqueGates([
    ...temporaryOpenGates(sim),
    ...permanentlyOpenGatesNearPosition(sim, body, radius),
  ]).filter(({ x, y }) => isWithinRadius({ x, y, body, radius }));
}

function temporaryOpenGates(sim: SimState): MiniBossArenaGateSnapshot[] {
  return miniBossArenaEntries(sim).map(({ gate }) => ({
    x: gate.x,
    y: gate.y,
  }));
}

function permanentlyOpenGates(sim: SimState): MiniBossArenaGateSnapshot[] {
  const cache = permanentGateCacheFor(sim);
  const revision = defeatedMiniBossArenaRevision(sim);
  if (cache.revision === revision) return cache.gates;
  cache.revision = revision;
  cache.gates = [...sim.defeatedMiniBossArenas]
    .sort()
    .flatMap((arenaKey) => gatesForArenaKey(sim, arenaKey));
  return cache.gates;
}

function permanentlyOpenGatesNearPosition(
  sim: SimState,
  body: { readonly x: number; readonly y: number },
  radius: number,
): MiniBossArenaGateSnapshot[] {
  return chunksWithinTileRadius(body, radius).flatMap(({ cx, cy }) => {
    const key = miniBossArenaKey({ floor: sim.world.floor, cx, cy });
    if (!sim.defeatedMiniBossArenas.has(key)) return [];
    return gatesForArenaChunk(sim, { cx, cy });
  });
}

function gatesForArenaKey(
  sim: SimState,
  arenaKey: string,
): MiniBossArenaGateSnapshot[] {
  const chunk = parseArenaChunk(arenaKey, sim.world.floor);
  if (!chunk) return [];
  return gatesForArenaChunk(sim, chunk);
}

function gatesForArenaChunk(
  sim: SimState,
  chunk: { readonly cx: number; readonly cy: number },
): MiniBossArenaGateSnapshot[] {
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    ...chunk,
    generatedFloor: sim.world.generatedFloor,
  });
  return arena?.gates.map(({ x, y }) => ({ x, y })) ?? [];
}

function isWithinRadius(input: {
  readonly x: number;
  readonly y: number;
  readonly body: { readonly x: number; readonly y: number };
  readonly radius: number;
}): boolean {
  return Math.hypot(
    input.x + 0.5 - input.body.x,
    input.y + 0.5 - input.body.y,
  ) <= input.radius;
}

interface PermanentGateCache {
  revision: number;
  gates: MiniBossArenaGateSnapshot[];
}

const permanentGateCaches = new WeakMap<SimState, PermanentGateCache>();

function permanentGateCacheFor(sim: SimState): PermanentGateCache {
  const existing = permanentGateCaches.get(sim);
  if (existing) return existing;
  const cache = { revision: -1, gates: [] };
  permanentGateCaches.set(sim, cache);
  return cache;
}

function parseArenaChunk(
  arenaKey: string,
  floor: number,
): { readonly cx: number; readonly cy: number } | null {
  const match = /^(-?\d+):(-?\d+),(-?\d+)$/.exec(arenaKey);
  if (!match || Number(match[1]) !== floor) return null;
  return { cx: Number(match[2]), cy: Number(match[3]) };
}

function uniqueGates(
  gates: readonly MiniBossArenaGateSnapshot[],
): MiniBossArenaGateSnapshot[] {
  const byPosition = new Map<string, MiniBossArenaGateSnapshot>();
  for (const gate of gates) byPosition.set(`${gate.x},${gate.y}`, gate);
  return [...byPosition.values()]
    .sort((left, right) => left.y - right.y || left.x - right.x);
}

function openGateOverride(
  gate: MiniBossArenaGateSnapshot,
): TileFeatureOverride {
  return {
    ...gate,
    tile: TILE.Floor,
    featureFace: FEATURE_FACE.Top,
    featureHeight: 0,
  };
}
