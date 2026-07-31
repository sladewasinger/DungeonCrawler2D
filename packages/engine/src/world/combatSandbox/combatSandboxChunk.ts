import {
  CHUNK_SIZE,
  TERRAIN,
  TILE,
  type Chunk,
} from "../core/types.js";
import { COMBAT_SANDBOX_LAYOUT } from "./combatSandboxLayout.js";

const CELL_COUNT = CHUNK_SIZE * CHUNK_SIZE;

/** Deterministic flat arena used by both authoritative and predicted worlds. */
export function generateCombatSandboxChunk(cx: number, cy: number): Chunk {
  const chunk = emptyChunk(cx, cy);
  for (let index = 0; index < CELL_COUNT; index++) {
    const x = cx * CHUNK_SIZE + index % CHUNK_SIZE;
    const y = cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
    writeCell({ chunk, index, x, y });
  }
  return chunk;
}

function emptyChunk(cx: number, cy: number): Chunk {
  return {
    cx,
    cy,
    tiles: new Uint8Array(CELL_COUNT),
    terrain: new Uint8Array(CELL_COUNT).fill(TERRAIN.Floor),
    features: new Uint8Array(CELL_COUNT),
    featureFaces: new Uint8Array(CELL_COUNT),
    featureHeight: new Float32Array(CELL_COUNT),
    height: new Float32Array(CELL_COUNT),
    zones: new Uint8Array(CELL_COUNT),
  };
}

interface CombatSandboxCell {
  readonly chunk: Chunk;
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

function writeCell({ chunk, index, x, y }: CombatSandboxCell): void {
  const height = authoredBlockHeight(x, y);
  if (height !== null) {
    chunk.height[index] = height;
    return;
  }
  if (isArenaPerimeter(x, y)) {
    writeWall(chunk, index);
    return;
  }
  if (!isWithinArena(x, y)) writeVoid(chunk, index);
}

function authoredBlockHeight(x: number, y: number): number | null {
  const block = COMBAT_SANDBOX_LAYOUT.blocks.find(
    (candidate) => candidate.x === x && candidate.y === y,
  );
  return block?.height ?? null;
}

function isArenaInterior(x: number, y: number): boolean {
  const { origin, width, height } = COMBAT_SANDBOX_LAYOUT.arena;
  return x > origin.x && x < origin.x + width - 1 &&
    y > origin.y && y < origin.y + height - 1;
}

function isArenaPerimeter(x: number, y: number): boolean {
  return isWithinArena(x, y) && !isArenaInterior(x, y);
}

function isWithinArena(x: number, y: number): boolean {
  const { origin, width, height } = COMBAT_SANDBOX_LAYOUT.arena;
  return x >= origin.x && x < origin.x + width &&
    y >= origin.y && y < origin.y + height;
}

function writeWall(chunk: Chunk, index: number): void {
  chunk.tiles[index] = TILE.Bedrock;
  chunk.height[index] = COMBAT_SANDBOX_LAYOUT.arena.wallHeight;
}

function writeVoid(chunk: Chunk, index: number): void {
  chunk.tiles[index] = TILE.Void;
  chunk.terrain[index] = TERRAIN.Void;
}
