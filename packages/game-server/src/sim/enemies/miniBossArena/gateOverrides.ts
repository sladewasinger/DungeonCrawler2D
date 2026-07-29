import {
  FEATURE_FACE,
  TILE,
  miniBossArenaForChunk,
  type MiniBossArenaGateSnapshot,
  type TileFeatureOverride,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";
import { MINI_BOSS_ARENA_RUNTIME_CONFIGURATION as CONFIG } from "./configuration.js";
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
  return miniBossArenaGateOverrides(sim)
    .filter(({ x, y }) => Math.hypot(x + 0.5 - body.x, y + 0.5 - body.y) <= radius)
    .map(({ x, y }) => ({ x, y }));
}

function temporaryOpenGates(sim: SimState): MiniBossArenaGateSnapshot[] {
  return miniBossArenaEntries(sim).map(({ gate }) => ({
    x: gate.x,
    y: gate.y,
  }));
}

function permanentlyOpenGates(sim: SimState): MiniBossArenaGateSnapshot[] {
  return [...sim.defeatedMiniBossArenas]
    .sort()
    .flatMap((arenaKey) => gatesForArenaKey(sim, arenaKey));
}

function gatesForArenaKey(
  sim: SimState,
  arenaKey: string,
): MiniBossArenaGateSnapshot[] {
  const chunk = parseArenaChunk(arenaKey, sim.world.floor);
  if (!chunk) return [];
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    ...chunk,
  });
  return arena?.gates.map(({ x, y }) => ({ x, y })) ?? [];
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
