import { CHUNK_SIZE, TILE, ZONE, type Chunk } from "../types.js";

/**
 * Stretch rooms (GAME_DESIGN.md § Safe rooms): instanced sub-maps that
 * safe-room doors teleport into. They live in a reserved chunk band far
 * from the playable floor — deterministic geometry, so client and
 * server generate identical rooms; *identity* (who may enter) is
 * enforced server-side via teleports, and rooms are spaced further
 * apart than the AOI radius, so neighbors never replicate.
 */

/** Chunk rows at/below this cy are room space, not floor terrain. */
export const ROOM_REGION_CY = 4096;
/** One room slot every 2 chunks — 64 tiles > AOI_RADIUS. */
const SLOT_STRIDE_CHUNKS = 2;
/** Safe-room rows start below the personal/party rows (see safeRoomChunk). */
const SAFE_ROOM_BASE_CY = ROOM_REGION_CY + 2 * SLOT_STRIDE_CHUNKS;

export const PERSONAL_ROOM_W = 13;
export const PERSONAL_ROOM_H = 9;
export const PARTY_ROOM_W = 17;
export const PARTY_ROOM_H = 13;
export const SAFE_ROOM_W = 17;
export const SAFE_ROOM_H = 11;

export function isRoomChunk(cy: number): boolean {
  return cy >= ROOM_REGION_CY;
}

/** Personal rooms on row ROOM_REGION_CY; party rooms two rows below. */
export function personalRoomChunk(slot: number): { cx: number; cy: number } {
  return { cx: slot * SLOT_STRIDE_CHUNKS, cy: ROOM_REGION_CY };
}

export function partyRoomChunk(slot: number): { cx: number; cy: number } {
  return { cx: slot * SLOT_STRIDE_CHUNKS, cy: ROOM_REGION_CY + SLOT_STRIDE_CHUNKS };
}

/** Fold a signed integer onto 0,1,2,… so any door chunk gets a room slot. */
function zigzag(n: number): number {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

/**
 * The shared safe room behind an overworld safe-room door, keyed by the
 * door's chunk coords — same door, same room, for everyone.
 */
export function safeRoomChunk(doorCx: number, doorCy: number): { cx: number; cy: number } {
  return {
    cx: zigzag(doorCx) * SLOT_STRIDE_CHUNKS,
    cy: SAFE_ROOM_BASE_CY + zigzag(doorCy) * SLOT_STRIDE_CHUNKS,
  };
}

function roomCenter(chunk: { cx: number; cy: number }): { x: number; y: number } {
  return {
    x: chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
    y: chunk.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
  };
}

/** Where a teleport into the room lands you (one row above the exit door). */
export function personalRoomSpawn(slot: number): { x: number; y: number } {
  const c = roomCenter(personalRoomChunk(slot));
  return { x: c.x + 0.5, y: c.y + 1.5 };
}

export function partyRoomSpawn(slot: number): { x: number; y: number } {
  const c = roomCenter(partyRoomChunk(slot));
  return { x: c.x + 0.5, y: c.y + 3.5 };
}

export function safeRoomSpawn(doorCx: number, doorCy: number): { x: number; y: number } {
  const c = roomCenter(safeRoomChunk(doorCx, doorCy));
  return { x: c.x + 0.5, y: c.y + 2.5 };
}

/** World tile coords of a safe room's fixtures (tests, UI hints). */
export function safeRoomFeatures(doorCx: number, doorCy: number): {
  doorPersonal: { x: number; y: number };
  doorParty: { x: number; y: number };
  exit: { x: number; y: number };
  stash: { x: number; y: number };
  table: { x: number; y: number };
} {
  const chunk = safeRoomChunk(doorCx, doorCy);
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseY = chunk.cy * CHUNK_SIZE;
  const left = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_H / 2);
  const centerX = baseX + Math.floor(CHUNK_SIZE / 2);
  return {
    doorPersonal: { x: centerX - 2, y: baseY + top + 1 },
    doorParty: { x: centerX + 2, y: baseY + top + 1 },
    exit: { x: centerX, y: baseY + top + SAFE_ROOM_H - 2 },
    stash: { x: baseX + left + 1, y: baseY + top + 1 },
    table: { x: baseX + left + SAFE_ROOM_W - 2, y: baseY + top + 1 },
  };
}

/** World tile coords of a personal room's fixtures (tests, UI hints). */
export function personalRoomFeatures(slot: number): {
  stash: { x: number; y: number };
  table: { x: number; y: number };
  exit: { x: number; y: number };
} {
  const chunk = personalRoomChunk(slot);
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseY = chunk.cy * CHUNK_SIZE;
  const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
  return {
    stash: { x: baseX + left + 1, y: baseY + top + 1 },
    table: { x: baseX + left + PERSONAL_ROOM_W - 2, y: baseY + top + 1 },
    exit: { x: baseX + Math.floor(CHUNK_SIZE / 2), y: baseY + top + PERSONAL_ROOM_H - 2 },
  };
}

/**
 * Generate a chunk in the room region: solid wall/void except where a
 * room template is carved. Every room interior is sanctuary — no
 * fighting in anyone's home.
 */
/**
 * Room walls rise far beyond the jump apex (≈2.2): stretch rooms stay
 * sealed — no hopping the perimeter into the void band.
 */
const ROOM_WALL_RISE = 6;

type RoomKind = "personal" | "party" | "safe";

interface RoomSlot {
  kind: RoomKind;
  w: number;
  h: number;
}

/** Which room template (if any) occupies this chunk (pure). */
function roomSlotAt(cx: number, cy: number): RoomSlot | null {
  const isSlotColumn = cx % SLOT_STRIDE_CHUNKS === 0 && cx >= 0;
  if (!isSlotColumn) return null;
  if (cy === ROOM_REGION_CY) return { kind: "personal", w: PERSONAL_ROOM_W, h: PERSONAL_ROOM_H };
  if (cy === ROOM_REGION_CY + SLOT_STRIDE_CHUNKS) {
    return { kind: "party", w: PARTY_ROOM_W, h: PARTY_ROOM_H };
  }
  if (cy >= SAFE_ROOM_BASE_CY && (cy - SAFE_ROOM_BASE_CY) % SLOT_STRIDE_CHUNKS === 0) {
    return { kind: "safe", w: SAFE_ROOM_W, h: SAFE_ROOM_H };
  }
  return null;
}

type SetTile = (lx: number, ly: number, tile: number, zone?: number) => void;

/** Carve the sanctuary interior; walls stay on the perimeter ring. */
function carveInterior(set: SetTile, left: number, top: number, w: number, h: number): void {
  for (let ly = top + 1; ly < top + h - 1; ly++) {
    for (let lx = left + 1; lx < left + w - 1; lx++) {
      set(lx, ly, TILE.Floor);
    }
  }
}

/** Place the exit door plus this room kind's fixtures. */
function placeFixtures(
  set: SetTile,
  kind: RoomKind,
  left: number,
  top: number,
  w: number,
  h: number,
): void {
  const centerLx = Math.floor(CHUNK_SIZE / 2);
  set(centerLx, top + h - 2, TILE.DoorExit);

  if (kind === "personal") {
    // Stash on the west wall, crafting table on the east wall.
    set(left + 1, top + 1, TILE.Stash);
    set(left + w - 2, top + 1, TILE.CraftingTable);
  } else if (kind === "safe") {
    // The shared safe room: personal + party doors on the north row
    // (portals — shared geometry, per-player destinations), with a
    // communal stash and crafting table in the corners.
    set(centerLx - 2, top + 1, TILE.DoorPersonal);
    set(centerLx + 2, top + 1, TILE.DoorParty);
    set(left + 1, top + 1, TILE.Stash);
    set(left + w - 2, top + 1, TILE.CraftingTable);
  } else {
    // Party room: a personal door on the north wall — each member's
    // own room, one door, different destinations (that's the trick:
    // the door is shared geometry; the server teleports per-player).
    set(centerLx, top + 1, TILE.DoorPersonal);
  }
}

export function generateRoomChunk(cx: number, cy: number): Chunk {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Wall);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE).fill(ROOM_WALL_RISE);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  const slot = roomSlotAt(cx, cy);
  if (!slot) return { cx, cy, tiles, height, zones };

  const { kind, w, h } = slot;
  const left = Math.floor(CHUNK_SIZE / 2 - w / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - h / 2);

  const set: SetTile = (lx, ly, tile, zone = ZONE.Sanctuary) => {
    const i = ly * CHUNK_SIZE + lx;
    tiles[i] = tile;
    zones[i] = zone;
    height[i] = 0; // carved interior sits at floor level
  };

  carveInterior(set, left, top, w, h);
  placeFixtures(set, kind, left, top, w, h);

  return { cx, cy, tiles, height, zones };
}
