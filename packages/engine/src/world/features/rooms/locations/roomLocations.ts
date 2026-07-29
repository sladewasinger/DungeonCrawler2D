import { CHUNK_SIZE } from "../../../core/types.js";
import {
  PARTY_ROOM_H,
  PARTY_ROOM_W,
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  ROOM_REGION_CY,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  type RoomKind,
  type RoomSlot,
} from "../roomModel.js";
import { spawnRoomSlotAt } from "../spawnRoom.js";
import { ROOM_SLOT_STRIDE_CHUNKS } from "../roomConfiguration/roomTuning.js";

const SAFE_ROOM_BASE_CY =
  ROOM_REGION_CY + 2 * ROOM_SLOT_STRIDE_CHUNKS;

export function isRoomChunk(cy: number): boolean {
  return cy >= ROOM_REGION_CY;
}

export function personalRoomChunk(slot: number): { cx: number; cy: number } {
  return { cx: slot * ROOM_SLOT_STRIDE_CHUNKS, cy: ROOM_REGION_CY };
}

export function partyRoomChunk(slot: number): { cx: number; cy: number } {
  return {
    cx: slot * ROOM_SLOT_STRIDE_CHUNKS,
    cy: ROOM_REGION_CY + ROOM_SLOT_STRIDE_CHUNKS,
  };
}

export function safeRoomChunk(
  doorCx: number,
  doorCy: number,
): { cx: number; cy: number } {
  return {
    cx: zigzag(doorCx) * ROOM_SLOT_STRIDE_CHUNKS,
    cy: SAFE_ROOM_BASE_CY + zigzag(doorCy) * ROOM_SLOT_STRIDE_CHUNKS,
  };
}

export function displayCoordinates(
  x: number,
  y: number,
): { x: number; y: number } {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  if (!isRoomChunk(cy)) return { x, y };
  const center = roomCenter({ cx, cy });
  return { x: x - center.x, y: y - center.y };
}

export function personalRoomSpawn(slot: number): { x: number; y: number } {
  const center = roomCenter(personalRoomChunk(slot));
  return { x: center.x + 0.5, y: center.y + 1.5 };
}

export function partyRoomSpawn(slot: number): { x: number; y: number } {
  const center = roomCenter(partyRoomChunk(slot));
  return { x: center.x + 0.5, y: center.y + 3.5 };
}

export function safeRoomSpawn(
  doorCx: number,
  doorCy: number,
): { x: number; y: number } {
  const center = roomCenter(safeRoomChunk(doorCx, doorCy));
  return { x: center.x + 0.5, y: center.y + 2.5 };
}

export function roomCenterAt(
  cx: number,
  cy: number,
): { x: number; y: number } {
  return roomCenter({ cx, cy });
}

export function safeRoomAttendantPosition(
  cx: number,
  cy: number,
): { x: number; y: number } {
  const center = roomCenter({ cx, cy });
  return { x: center.x - 5.5, y: center.y - 3.5 };
}

export function roomSlotAt(cx: number, cy: number): RoomSlot | null {
  const spawnRoom = spawnRoomSlotAt(cx, cy);
  if (spawnRoom) return spawnRoom;
  const isSlotColumn = cx % ROOM_SLOT_STRIDE_CHUNKS === 0 && cx >= 0;
  if (!isSlotColumn) return null;
  return roomSlotForRow(cy);
}

export function roomKindAt(cx: number, cy: number): RoomKind | null {
  return roomSlotAt(cx, cy)?.kind ?? null;
}

function roomSlotForRow(cy: number): RoomSlot | null {
  if (cy === ROOM_REGION_CY) {
    return { kind: "personal", w: PERSONAL_ROOM_W, h: PERSONAL_ROOM_H };
  }
  if (cy === ROOM_REGION_CY + ROOM_SLOT_STRIDE_CHUNKS) {
    return { kind: "party", w: PARTY_ROOM_W, h: PARTY_ROOM_H };
  }
  return isSafeRoomRow(cy)
    ? { kind: "safe", w: SAFE_ROOM_W, h: SAFE_ROOM_H }
    : null;
}

function isSafeRoomRow(cy: number): boolean {
  return cy >= SAFE_ROOM_BASE_CY &&
    (cy - SAFE_ROOM_BASE_CY) % ROOM_SLOT_STRIDE_CHUNKS === 0;
}

function roomCenter(
  chunk: { readonly cx: number; readonly cy: number },
): { x: number; y: number } {
  return {
    x: chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
    y: chunk.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
  };
}

function zigzag(value: number): number {
  return value >= 0 ? 2 * value : -2 * value - 1;
}
