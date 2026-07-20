import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  ATTACK_COOLDOWN_MS,
  CHUNK_SIZE,
  LEVEL,
  TICK_RATE,
  TILE,
  World,
  buildContentRegistry,
  hashString,
  isSafeRoomChunk,
  type ClientInput,
  type ContentRegistry,
  type Entity,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import { GameSim } from "../index.js";
import { PlayerStore } from "../../store.js";

/**
 * Shared fixtures for the GameSim integration suite (sim/integration/):
 * headless multi-client tests that drive the exact sim the ws server
 * runs in production, minus the sockets. Ported from
 * reference/game-server/sim.test.ts, split by epic to respect the
 * 200-line file cap, and adapted to the v2 BSP world generator — no
 * coordinate here is a hardcoded v1 sandbox-chunk tile; everything is
 * either a relative offset from a live spawn/anchor or a deterministic
 * query against the running World.
 */

export const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export const SEED = hashString("sim-test-world");
/** Ticks until the next melee swing is accepted (see sim/actions/melee.ts). */
export const SWING_TICKS = Math.round((ATTACK_COOLDOWN_MS / 1000) * TICK_RATE);

export function makeSim(rngSeed = 1234, opts: { testFixtures?: boolean; debugCommands?: boolean } = { testFixtures: true }): GameSim {
  return new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, new PlayerStore(null), rngSeed, opts);
}

export function input(seq: number, moveX: -1 | 0 | 1, moveY: -1 | 0 | 1, jump = false, run = false): ClientInput {
  return { type: "input", seq, moveX, moveY, jump, run };
}

/** Force-place an entity, resetting fall tracking as if it just landed there. */
export function teleport(entity: Entity, x: number, y: number, sim: GameSim): void {
  entity.body.x = x;
  entity.body.y = y;
  entity.body.z = sim.world.groundAt(x, y);
  entity.body.grounded = true;
  entity.body.fallStart = entity.body.z;
}

export function stepN(sim: GameSim, n: number): Map<string, ServerSnapshot> {
  let out = new Map<string, ServerSnapshot>();
  for (let i = 0; i < n; i++) out = sim.step();
  return out;
}

export function eventsOf(snapshots: Map<string, ServerSnapshot>, id: string): GameEvent[] {
  return snapshots.get(id)?.events ?? [];
}

/** Two players, already partied (A invites, B accepts, one tick apart). */
export function makeParty(sim: GameSim): { aId: string; bId: string } {
  const a = sim.addPlayer("A", "client-a");
  const b = sim.addPlayer("B", "client-b");
  teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + 2, a.spawn.y, sim);
  sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
  sim.step();
  sim.queueAction(b.playerId, { type: "party", op: "accept" });
  sim.step();
  return { aId: a.playerId, bId: b.playerId };
}

export function nearbyAreaTile(sim: GameSim, x: number, y: number, tag: string): string | null {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      if (sim.areas.hasTagAt(tx, ty, tag)) return sim.areas.defAt(tx, ty);
    }
  }
  return null;
}

/**
 * A real overworld safe-room door, found by scanning chunks the same
 * way the generator itself decides where one goes (`isSafeRoomChunk`)
 * instead of trusting a fixed v1 tile that no longer means anything
 * under the BSP generator.
 */
export function findSafeRoomDoor(sim: GameSim): { x: number; y: number; doorCx: number; doorCy: number } {
  for (let cy = 0; cy < 16; cy++) {
    for (let cx = 0; cx < 16; cx++) {
      if (!isSafeRoomChunk(sim.world.worldSeed, sim.world.floor, cx, cy)) continue;
      const found = scanChunkForDoor(sim, cx, cy);
      if (found) return { ...found, doorCx: cx, doorCy: cy };
    }
  }
  throw new Error("no safe-room door found within the scanned chunk range");
}

function scanChunkForDoor(sim: GameSim, cx: number, cy: number): { x: number; y: number } | null {
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = cx * CHUNK_SIZE + lx;
      const y = cy * CHUNK_SIZE + ly;
      if (sim.world.tileAt(x, y) === TILE.DoorSafeRoom) return { x, y };
    }
  }
  return null;
}

function isFlatFloor(sim: GameSim, x: number, y: number): boolean {
  return (
    sim.world.isWalkable(x, y) &&
    sim.world.tileAt(x, y) !== TILE.Wall &&
    sim.world.heightAt(x, y) === 0 &&
    !sim.world.isSanctuary(x, y)
  );
}

/** Spiral out from (ax, ay) for the first tile whose top-left corner
 * clears `predicate` within `clearance` tiles in every direction. */
function spiralFind(
  ax: number,
  ay: number,
  maxRadius: number,
  predicate: (x: number, y: number) => boolean,
): { x: number; y: number } {
  // Tile queries index a Uint8Array by integer offset — floor the anchor
  // so a caller passing a tile-center float (x.5) still lands on a real tile.
  const startX = Math.floor(ax);
  const startY = Math.floor(ay);
  for (let radius = 0; radius < maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = startX + dx;
        const y = startY + dy;
        if (predicate(x, y)) return { x, y };
      }
    }
  }
  throw new Error(`no tile satisfying the predicate found near (${ax}, ${ay})`);
}

/** Nearest walkable, non-sanctuary, height-0 tile to (ax, ay) — a flat
 * drop zone for fall-damage arithmetic that doesn't depend on terrain. */
export function findFlatFloor(sim: GameSim, ax: number, ay: number): { x: number; y: number } {
  const tile = spiralFind(ax, ay, 96, (x, y) => isFlatFloor(sim, x, y));
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}

/**
 * A flat, co-height, wall-free patch at least `clearance` tiles in
 * every direction — a combat arena. Melee's vertical-reach check
 * (±1.5) means two combatants a couple of tiles apart on a natural
 * (non-hand-authored) BSP room can land on different terrain steps;
 * tests that place multiple entities by fixed offsets need this
 * instead of a single flat tile.
 */
export function findFlatArena(sim: GameSim, ax: number, ay: number, clearance = 2): { x: number; y: number } {
  const isClear = (x: number, y: number): boolean => {
    for (let dy = -clearance; dy <= clearance; dy++) {
      for (let dx = -clearance; dx <= clearance; dx++) {
        if (!isFlatFloor(sim, x + dx, y + dy)) return false;
      }
    }
    return true;
  };
  const tile = spiralFind(ax, ay, 64, isClear);
  return { x: tile.x + 0.5, y: tile.y + 0.5 };
}
