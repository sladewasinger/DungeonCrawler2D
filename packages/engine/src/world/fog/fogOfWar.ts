/** Pure 8x8-tile Fog-of-War bitset model, reveal sweeps, delta sync, and compact encoding. */
import { clamp } from "../../math/noise.js";
import { CHUNK_SIZE, chunkKey, worldToChunkCoord, worldToLocalCoord } from "../types.js";

export const FOG_CELL_TILES = 8;
export const FOG_CELLS_PER_AXIS = CHUNK_SIZE / FOG_CELL_TILES;
export const FOG_CELLS_PER_CHUNK = FOG_CELLS_PER_AXIS * FOG_CELLS_PER_AXIS;
export const FOG_REVEAL_RADIUS_BASE = 18;
export const FOG_REVEAL_RADIUS_ELEVATED_DAY = 22;

export interface FogChunkDelta {
  readonly cx: number;
  readonly cy: number;
  readonly mask: number;
}

export interface FogState {
  readonly chunks: Map<string, number>;
}

export interface FogRevealInput {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly isDaytime: boolean;
}

export function createFogState(initial?: readonly FogChunkDelta[]): FogState {
  const chunks = new Map<string, number>();
  const state: FogState = { chunks };
  if (initial) applyFogChunkDeltas(state, initial);
  return state;
}

export function getChunkFogMask(state: FogState, cx: number, cy: number): number {
  return state.chunks.get(chunkKey(cx, cy)) ?? 0;
}

export function isFogCellRevealed(state: FogState, cellX: number, cellY: number): boolean {
  const cx = Math.floor(cellX / FOG_CELLS_PER_AXIS);
  const cy = Math.floor(cellY / FOG_CELLS_PER_AXIS);
  const lx = cellX - cx * FOG_CELLS_PER_AXIS;
  const ly = cellY - cy * FOG_CELLS_PER_AXIS;
  const bit = ly * FOG_CELLS_PER_AXIS + lx;
  return (getChunkFogMask(state, cx, cy) & (1 << bit)) !== 0;
}

export function isFogTileRevealed(state: FogState, wx: number, wy: number): boolean {
  const tx = Math.floor(wx);
  const ty = Math.floor(wy);
  const cx = worldToChunkCoord(tx);
  const cy = worldToChunkCoord(ty);
  const cellX = Math.floor(worldToLocalCoord(tx, cx) / FOG_CELL_TILES);
  const cellY = Math.floor(worldToLocalCoord(ty, cy) / FOG_CELL_TILES);
  const bit = cellY * FOG_CELLS_PER_AXIS + cellX;
  return (getChunkFogMask(state, cx, cy) & (1 << bit)) !== 0;
}

export function revealRadiusFor(elevation: number, isDaytime: boolean): number {
  return elevation >= 1 && isDaytime ? FOG_REVEAL_RADIUS_ELEVATED_DAY : FOG_REVEAL_RADIUS_BASE;
}

function cellDistanceToPoint(cell: { readonly cellX: number; readonly cellY: number }, point: { readonly x: number; readonly y: number }): number {
  const minX = cell.cellX * FOG_CELL_TILES;
  const minY = cell.cellY * FOG_CELL_TILES;
  const nearestX = clamp(point.x, minX, minX + FOG_CELL_TILES);
  const nearestY = clamp(point.y, minY, minY + FOG_CELL_TILES);
  return Math.hypot(nearestX - point.x, nearestY - point.y);
}

function markCellRevealed(
  ctx: { readonly state: FogState; readonly dirty: Map<string, FogChunkDelta> },
  cell: { readonly cellX: number; readonly cellY: number },
): void {
  const cx = Math.floor(cell.cellX / FOG_CELLS_PER_AXIS);
  const cy = Math.floor(cell.cellY / FOG_CELLS_PER_AXIS);
  const lcx = cell.cellX - cx * FOG_CELLS_PER_AXIS;
  const lcy = cell.cellY - cy * FOG_CELLS_PER_AXIS;
  const key = chunkKey(cx, cy);
  const prev = ctx.state.chunks.get(key) ?? 0;
  const next = prev | (1 << (lcy * FOG_CELLS_PER_AXIS + lcx));
  if (next === prev) return;
  ctx.state.chunks.set(key, next);
  ctx.dirty.set(key, { cx, cy, mask: next });
}

export function revealFogAroundPlayer(state: FogState, input: FogRevealInput): FogChunkDelta[] {
  const radius = revealRadiusFor(input.elevation, input.isDaytime);
  const minCellX = Math.floor((input.x - radius) / FOG_CELL_TILES);
  const maxCellX = Math.floor((input.x + radius) / FOG_CELL_TILES);
  const minCellY = Math.floor((input.y - radius) / FOG_CELL_TILES);
  const maxCellY = Math.floor((input.y + radius) / FOG_CELL_TILES);
  const dirty = new Map<string, FogChunkDelta>();

  for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      if (cellDistanceToPoint({ cellX, cellY }, input) <= radius) {
        markCellRevealed({ state, dirty }, { cellX, cellY });
      }
    }
  }
  return Array.from(dirty.values());
}

export function applyFogChunkDeltas(state: FogState, deltas: readonly FogChunkDelta[]): void {
  for (const delta of deltas) {
    const cleanMask = delta.mask & 0xffff;
    if (cleanMask === 0) continue;
    const key = chunkKey(delta.cx, delta.cy);
    state.chunks.set(key, (state.chunks.get(key) ?? 0) | cleanMask);
  }
}

export function exportAllFogDeltas(state: FogState): FogChunkDelta[] {
  const out: FogChunkDelta[] = [];
  for (const [key, mask] of state.chunks.entries()) {
    const clean = mask & 0xffff;
    if (clean === 0) continue;
    const sep = key.indexOf(",");
    const cx = Number(key.slice(0, sep));
    const cy = Number(key.slice(sep + 1));
    out.push({ cx, cy, mask: clean });
  }
  return out;
}

export function countRevealedFogCells(state: FogState): number {
  let total = 0;
  for (const mask of state.chunks.values()) {
    let m = mask & 0xffff;
    while (m !== 0) {
      total += m & 1;
      m >>>= 1;
    }
  }
  return total;
}

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const RECORD_BYTES = 10;

function encodeB64Idx(present: boolean, sextet: number): string {
  return present ? (B64_ALPHABET[sextet & 63] ?? "") : "=";
}

function encodeTriplet(bytes: Uint8Array, offset: number): string {
  const triplet = ((bytes[offset] ?? 0) << 16) | ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0);
  const c0 = encodeB64Idx(true, triplet >>> 18);
  const c1 = encodeB64Idx(true, triplet >>> 12);
  const c2 = encodeB64Idx(offset + 1 < bytes.length, triplet >>> 6);
  const c3 = encodeB64Idx(offset + 2 < bytes.length, triplet);
  return `${c0}${c1}${c2}${c3}`;
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) out += encodeTriplet(bytes, i);
  return out;
}

function decodeBase64Char(ch: string): number {
  const code = B64_ALPHABET.indexOf(ch);
  return code >= 0 ? code : 0;
}

function decodeQuadToOut(q: { readonly clean: string; readonly offset: number; readonly out: Uint8Array; readonly ptr: number }): number {
  const { clean, offset, out } = q;
  let ptr = q.ptr;
  const v0 = decodeBase64Char(clean[offset] ?? "");
  const v1 = decodeBase64Char(clean[offset + 1] ?? "");
  const v2 = decodeBase64Char(clean[offset + 2] ?? "");
  const v3 = decodeBase64Char(clean[offset + 3] ?? "");
  const triplet = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
  if (ptr < out.length) out[ptr++] = (triplet >>> 16) & 0xff;
  if (ptr < out.length) out[ptr++] = (triplet >>> 8) & 0xff;
  if (ptr < out.length) out[ptr++] = triplet & 0xff;
  return ptr;
}

function decodeBase64Bytes(encoded: string): Uint8Array {
  const clean = encoded.replace(/[^A-Za-z0-9+/=]/g, "");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const outLen = Math.max(0, Math.floor((clean.length * 3) / 4) - pad);
  const out = new Uint8Array(outLen);
  let ptr = 0;
  for (let i = 0; i + 3 < clean.length; i += 4) ptr = decodeQuadToOut({ clean, offset: i, out, ptr });
  return out;
}

export function encodeFogMask(state: FogState): string {
  const entries = exportAllFogDeltas(state).sort((a, b) => (a.cx !== b.cx ? a.cx - b.cx : a.cy - b.cy));
  if (entries.length === 0) return "";
  const buf = new Uint8Array(entries.length * RECORD_BYTES);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const offset = i * RECORD_BYTES;
    view.setInt32(offset, entry.cx, false);
    view.setInt32(offset + 4, entry.cy, false);
    view.setUint16(offset + 8, entry.mask & 0xffff, false);
  }
  return encodeBase64Bytes(buf);
}

export function decodeFogMask(encoded: string | undefined): FogState {
  const state = createFogState();
  if (!encoded) return state;
  const bytes = decodeBase64Bytes(encoded);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + RECORD_BYTES <= bytes.byteLength; offset += RECORD_BYTES) {
    const cx = view.getInt32(offset, false);
    const cy = view.getInt32(offset + 4, false);
    const mask = view.getUint16(offset + 8, false);
    if (mask !== 0) state.chunks.set(chunkKey(cx, cy), mask);
  }
  return state;
}
