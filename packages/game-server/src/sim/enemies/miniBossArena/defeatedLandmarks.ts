import {
  CHUNK_SIZE,
  MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
  type DefeatedMiniBossArenaSnapshot,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../../state/state.js";

/** Complete authoritative defeat state for the receiver's bounded compass search. */
export function defeatedMiniBossArenasForSlot(
  sim: SimState,
  slot: PlayerSlot,
): DefeatedMiniBossArenaSnapshot[] {
  const center = chunkAt(slot.entity.body.x, slot.entity.body.y);
  return [...sim.defeatedMiniBossArenas]
    .flatMap((key) => defeatedArenaSnapshot(sim, key))
    .filter((arena) => isWithinCompassWindow(center, arena))
    .sort(compareArenaChunks);
}

function defeatedArenaSnapshot(
  sim: SimState,
  key: string,
): DefeatedMiniBossArenaSnapshot[] {
  const arena = parseArenaKey(key, sim.world.floor);
  return arena ? [arena] : [];
}

function chunkAt(x: number, y: number): { readonly cx: number; readonly cy: number } {
  return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(y / CHUNK_SIZE) };
}

function isWithinCompassWindow(
  center: { readonly cx: number; readonly cy: number },
  arena: DefeatedMiniBossArenaSnapshot,
): boolean {
  return Math.max(
    Math.abs(arena.cx - center.cx),
    Math.abs(arena.cy - center.cy),
  ) <= MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS;
}

function parseArenaKey(
  key: string,
  floor: number,
): DefeatedMiniBossArenaSnapshot | null {
  const match = /^(\d+):(-?\d+),(-?\d+)$/.exec(key);
  if (!match || Number(match[1]) !== floor) return null;
  return { cx: Number(match[2]), cy: Number(match[3]) };
}

function compareArenaChunks(
  left: DefeatedMiniBossArenaSnapshot,
  right: DefeatedMiniBossArenaSnapshot,
): number {
  return left.cy - right.cy || left.cx - right.cx;
}
