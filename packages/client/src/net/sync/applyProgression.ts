import { World, type ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { floorChangeEvents } from "../events/floorEvents.js";
import { xpGainEvents } from "../events/xpEvents.js";

interface ProgressionState {
  readonly xp: number;
  readonly level: number;
  readonly xpForNext: number;
}

export function applySnapshotProgression(conn: Connection, snap: ServerSnapshot): void {
  applyXpState(conn, progressionFrom(conn, snap));
  applyFloorState(conn, snap);
}

function progressionFrom(conn: Connection, snap: ServerSnapshot): ProgressionState {
  return {
    xp: snap.self.xp ?? conn.xp,
    level: snap.self.level ?? conn.charLevel,
    xpForNext: snap.self.xpForNext ?? conn.xpForNext,
  };
}

function applyXpState(conn: Connection, next: ProgressionState): void {
  if (conn.hasReceivedSnapshot) {
    conn.visualEvents.push(...xpGainEvents(
      { xp: conn.xp, level: conn.charLevel },
      { xp: next.xp, level: next.level },
    ));
  }
  conn.xp = next.xp;
  conn.charLevel = next.level;
  conn.xpForNext = next.xpForNext;
}

function applyFloorState(conn: Connection, snap: ServerSnapshot): void {
  const next = snap.self.floor ?? conn.welcome?.floor ?? conn.floor;
  if (conn.hasReceivedSnapshot) conn.visualEvents.push(...floorChangeEvents(conn.floor, next));
  if (next !== conn.floor && conn.world) {
    conn.world = new World(conn.world.worldSeed, next, {
      level: conn.world.level, features: conn.world.features,
    });
    conn.defeatedMiniBossArenaChunks.clear();
    conn.miniBossArenaLandmarkRevision++;
  }
  conn.floor = next;
}
