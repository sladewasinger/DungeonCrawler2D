import { CHUNK_SIZE } from "../../core/types.js";

export { generateRoomChunk } from "./roomChunkBuilder.js";

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
/** One room slot every 2 chunks — 64 tiles remain beyond AOI_RADIUS. */
const SLOT_STRIDE_CHUNKS = 2;
/** Safe-room rows start below the personal/party rows (see safeRoomChunk). */
const SAFE_ROOM_BASE_CY = ROOM_REGION_CY + 2 * SLOT_STRIDE_CHUNKS;

export const PERSONAL_ROOM_W = 13;
export const PERSONAL_ROOM_H = 9;
export const PARTY_ROOM_W = 17;
export const PARTY_ROOM_H = 13;
export const SAFE_ROOM_W = 17;
export const SAFE_ROOM_H = 11;
export const SAFE_ROOM_MAX_OCCUPANTS = 20;

export function isRoomChunk(cy: number): boolean { return cy >= ROOM_REGION_CY; }

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

/**
 * Converts the reserved-band world coordinates used by room simulation into a
 * room-local HUD readout. Overworld coordinates pass through unchanged.
 */
export function displayCoordinates(x: number, y: number): { x: number; y: number } {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  if (!isRoomChunk(cy)) return { x, y };
  const center = roomCenter({ cx, cy });
  return { x: x - center.x, y: y - center.y };
}

/** Where a teleport into the room lands you, one row inside the south exit. */
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

export function roomCenterAt(cx: number, cy: number): { x: number; y: number } {
  return roomCenter({ cx, cy });
}

export function safeRoomAttendantPosition(cx: number, cy: number): { x: number; y: number } {
  const center = roomCenter({ cx, cy });
  return { x: center.x - 5.5, y: center.y - 3.5 };
}

/** World tile coords of a safe room's fixtures (tests, UI hints). */
export function safeRoomFeatures(doorCx: number, doorCy: number): {
  doors: Array<{ x: number; y: number }>;
  exit: { x: number; y: number };
} {
  const chunk = safeRoomChunk(doorCx, doorCy);
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseY = chunk.cy * CHUNK_SIZE;
  const top = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_H / 2);
  const centerX = baseX + Math.floor(CHUNK_SIZE / 2);
  return {
    doors: safeRoomDoorPositions(chunk.cx, chunk.cy),
    // North wall (docs/ROADMAP.md's filed ruling, 2026-07-20: "exit doors
    // default to the north/back wall" — the safe room's north row has a
    // free center column, DoorPersonal/DoorParty sitting at +-2 either
    // side of it) — see placeFixtures's matching exitLy.
    exit: { x: centerX, y: baseY + top + SAFE_ROOM_H - 2 },
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
    exit: {
      x: baseX + Math.floor(CHUNK_SIZE / 2),
      y: baseY + top + PERSONAL_ROOM_H - 2,
    },
  };
}

/** Generate a chunk in the room region: Void except where a room template is carved.
 * Every room interior is sanctuary — no fighting in anyone's home.
 *
 * Room boundaries rise far beyond the jump apex (≈1.07): stretch rooms stay sealed.
 */
export type RoomKind = "personal" | "party" | "safe";

export interface RoomSlot {
  kind: RoomKind;
  w: number;
  h: number;
}

/** Which room template (if any) occupies this chunk (pure). */
export function roomSlotAt(cx: number, cy: number): RoomSlot | null {
  const isSlotColumn = cx % SLOT_STRIDE_CHUNKS === 0 && cx >= 0;
  if (!isSlotColumn) return null;
  return roomSlotForRow(cy);
}

function roomSlotForRow(cy: number): RoomSlot | null {
  if (cy === ROOM_REGION_CY) return { kind: "personal", w: PERSONAL_ROOM_W, h: PERSONAL_ROOM_H };
  if (cy === ROOM_REGION_CY + SLOT_STRIDE_CHUNKS) return { kind: "party", w: PARTY_ROOM_W, h: PARTY_ROOM_H };
  return isSafeRoomRow(cy) ? { kind: "safe", w: SAFE_ROOM_W, h: SAFE_ROOM_H } : null;
}

function isSafeRoomRow(cy: number): boolean {
  return cy >= SAFE_ROOM_BASE_CY && (cy - SAFE_ROOM_BASE_CY) % SLOT_STRIDE_CHUNKS === 0;
}

export function roomKindAt(cx: number, cy: number): RoomKind | null {
  return roomSlotAt(cx, cy)?.kind ?? null;
}

const SAFE_DOOR_LOCAL_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [8, 1], [10, 1], [12, 1], [14, 1],
  [15, 2], [15, 4], [15, 6], [15, 8],
  [14, 9], [12, 9], [10, 9], [6, 9], [4, 9], [2, 9],
  [1, 8], [1, 6], [1, 4], [1, 2],
  [2, 1], [4, 1],
];

/** Twenty clockwise portal positions, beginning at the north-wall center. */
export function safeRoomDoorPositions(cx: number, cy: number): Array<{ x: number; y: number }> {
  if (roomKindAt(cx, cy) !== "safe") return [];
  const left = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_H / 2);
  return SAFE_DOOR_LOCAL_POSITIONS.map(([dx, dy]) => ({
    x: cx * CHUNK_SIZE + left + dx,
    y: cy * CHUNK_SIZE + top + dy,
  }));
}

const PARTY_DOOR_LOCAL_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [6, 1], [8, 1], [10, 1], [12, 1], [14, 1],
  [15, 3], [15, 5], [15, 7], [15, 9],
  [14, 11], [12, 11], [10, 11], [6, 11], [4, 11], [2, 11],
  [1, 9], [1, 7], [1, 5], [1, 3], [2, 1],
];

/** One private personal-room portal site per possible party member. */
export function partyRoomDoorPositions(cx: number, cy: number): Array<{ x: number; y: number }> {
  if (roomKindAt(cx, cy) !== "party") return [];
  const left = Math.floor(CHUNK_SIZE / 2 - PARTY_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - PARTY_ROOM_H / 2);
  return PARTY_DOOR_LOCAL_POSITIONS.map(([dx, dy]) => ({
    x: cx * CHUNK_SIZE + left + dx,
    y: cy * CHUNK_SIZE + top + dy,
  }));
}
