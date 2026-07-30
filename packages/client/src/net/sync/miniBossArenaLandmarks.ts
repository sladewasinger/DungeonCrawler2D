import type { ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

/** Applies the complete defeated-arena window used by deterministic compass search. */
export function applyMiniBossArenaLandmarks(
  conn: Connection,
  snapshot: ServerSnapshot,
): void {
  const arenas = snapshot.defeatedMiniBossArenas;
  if (!arenas) return;
  const next = new Set(arenas.map(arenaChunkKey));
  if (sameArenaChunks(conn.defeatedMiniBossArenaChunks, next)) return;
  conn.defeatedMiniBossArenaChunks.clear();
  for (const key of next) conn.defeatedMiniBossArenaChunks.add(key);
  conn.miniBossArenaLandmarkRevision++;
}

function arenaChunkKey(
  arena: NonNullable<ServerSnapshot["defeatedMiniBossArenas"]>[number],
): string {
  return `${arena.cx},${arena.cy}`;
}

function sameArenaChunks(
  current: ReadonlySet<string>,
  next: ReadonlySet<string>,
): boolean {
  if (current.size !== next.size) return false;
  for (const key of current) {
    if (!next.has(key)) return false;
  }
  return true;
}
