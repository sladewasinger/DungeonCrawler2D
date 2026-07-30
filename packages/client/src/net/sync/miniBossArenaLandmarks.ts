import type { ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";

/** Applies the complete defeated-arena window used by deterministic compass search. */
export function applyMiniBossArenaLandmarks(
  conn: Connection,
  snapshot: ServerSnapshot,
): void {
  const window = snapshot.defeatedMiniBossArenaWindow;
  if (!window) return;
  const next = new Set(window.arenas.map(arenaChunkKey));
  const centerChanged = !sameCenter(conn.defeatedMiniBossArenaWindowCenter, window.center);
  if (!centerChanged && sameArenaChunks(conn.defeatedMiniBossArenaChunks, next)) return;
  conn.defeatedMiniBossArenaChunks.clear();
  for (const key of next) conn.defeatedMiniBossArenaChunks.add(key);
  conn.defeatedMiniBossArenaWindowCenter = window.center;
  conn.miniBossArenaLandmarkRevision++;
}

function arenaChunkKey(
  arena: NonNullable<ServerSnapshot["defeatedMiniBossArenaWindow"]>["arenas"][number],
): string {
  return `${arena.cx},${arena.cy}`;
}

function sameCenter(
  current: { readonly cx: number; readonly cy: number } | null,
  next: { readonly cx: number; readonly cy: number },
): boolean {
  return current !== null &&
    current.cx === next.cx &&
    current.cy === next.cy;
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
