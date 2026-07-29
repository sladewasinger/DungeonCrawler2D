import {
  CHUNK_SIZE, ROOM_WALL_RISE, TERRAIN, generateRoomChunk,
  partyRoomChunk, personalRoomChunk, safeRoomChunk, spawnRoomChunk,
  type Chunk,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS, type ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView, type Point } from "../../../view/transform/viewTransform.js";
import {
  planTerrain, TERRAIN_KINDS, type TerrainAOMask, type TerrainKind, type TerrainSource,
} from "../terrainPlanner.js";

const ROOM_CHUNKS = [
  personalRoomChunk(0),
  partyRoomChunk(0),
  safeRoomChunk(4, 7),
  spawnRoomChunk(),
] as const;

describe("inside room terrain presentation", () => {
  it.each([true, false])(
    "preserves every ground tile and only the camera-facing wall (VOID %s)",
    (voidTerrain) => {
      for (const room of ROOM_CHUNKS) {
        for (const orientation of VIEW_ORIENTATIONS) {
          assertRoomPlan(room, orientation, voidTerrain);
        }
      }
    },
  );

  it("leaves outside planning byte-for-byte unchanged", () => {
    const source = fixtureSource(generateRoomChunk(0, 4096), true);
    const bounds = { x: 0, y: 4096 * CHUNK_SIZE, width: CHUNK_SIZE, height: CHUNK_SIZE };
    const implicitSource = {
      voidTerrain: source.voidTerrain,
      terrainAt: source.terrainAt,
      heightAt: source.heightAt,
    };
    const implicit = planTerrain(implicitSource, { bounds, orientation: 0 });
    const explicit = planTerrain({
      ...source,
      presentationAt: () => ({ mode: "outside", wallRise: 0 }),
    }, { bounds, orientation: 0 });

    expect(explicit.batches).toEqual(implicit.batches);
  });
});

function assertRoomPlan(
  room: { readonly cx: number; readonly cy: number },
  orientation: ViewOrientation,
  voidTerrain: boolean,
): void {
  const chunk = generateRoomChunk(room.cx, room.cy, voidTerrain);
  const source = fixtureSource(chunk, voidTerrain);
  const plan = planTerrain(source, { bounds: chunkBounds(chunk), orientation });
  const expected = expectedVisibleTiles(chunk, source, orientation);
  const caps = new Set(plan.batches.floors.map(({ worldTile }) => tileKey(worldTile)));
  const faces = new Set(plan.batches.southFaces.map(({ worldTile }) => tileKey(worldTile)));

  expect(plan.batches.voids, roomLabel(room, orientation)).toEqual([]);
  expect(caps, roomLabel(room, orientation)).toEqual(expected.caps);
  expect(faces, roomLabel(room, orientation)).toEqual(expected.walls);
  expect(plan.batches.southFaces.every((face) =>
    face.topHeight - face.bottomHeight === ROOM_WALL_RISE)).toBe(true);
  expect(plan.batches.ao.filter(({ surface }) => surface === "floor")
    .every(({ mask }) => onlyNorthShadow(mask))).toBe(true);
}

function onlyNorthShadow(mask: TerrainAOMask): boolean {
  const { north, ...otherSides } = mask;
  return north && Object.values(otherSides).every((shadowed) => !shadowed);
}

function expectedVisibleTiles(chunk: Chunk, source: TerrainSource, orientation: ViewOrientation): {
  readonly caps: Set<string>;
  readonly walls: Set<string>;
} {
  const caps = new Set<string>();
  const walls = new Set<string>();
  forEachChunkTile(chunk, (tile) => {
    const terrain = source.terrainAt(tile.x, tile.y);
    const height = source.heightAt(tile.x, tile.y);
    if (terrain === TERRAIN_KINDS.Floor && height < ROOM_WALL_RISE) {
      caps.add(tileKey(tile));
      return;
    }
    if (!facesGround(source, tile, orientation)) return;
    caps.add(tileKey(tile));
    walls.add(tileKey(tile));
  });
  return { caps, walls };
}

function facesGround(
  source: TerrainSource,
  tile: Point,
  orientation: ViewOrientation,
): boolean {
  const view = worldTileToView(tile, orientation);
  const south = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
  return source.terrainAt(south.x, south.y) === TERRAIN_KINDS.Floor &&
    source.heightAt(south.x, south.y) < ROOM_WALL_RISE;
}

function fixtureSource(chunk: Chunk, voidTerrain: boolean): TerrainSource {
  const cell = (x: number, y: number) =>
    cellAt({ chunk, tile: { x, y }, voidTerrain });
  return {
    voidTerrain,
    presentationAt: () => ({ mode: "inside", wallRise: ROOM_WALL_RISE }),
    terrainAt: (x, y) => cell(x, y).terrain,
    heightAt: (x, y) => cell(x, y).height,
  };
}

interface CellRequest { readonly chunk: Chunk; readonly tile: Point; readonly voidTerrain: boolean; }

function cellAt(request: CellRequest): { readonly terrain: TerrainKind; readonly height: number } {
  const { chunk, tile, voidTerrain } = request;
  const lx = tile.x - chunk.cx * CHUNK_SIZE;
  const ly = tile.y - chunk.cy * CHUNK_SIZE;
  if (!isChunkCell(lx, ly)) return exteriorCell(voidTerrain);
  const index = ly * CHUNK_SIZE + lx;
  return {
    terrain: chunk.terrain[index] === TERRAIN.Void
      ? TERRAIN_KINDS.Void
      : TERRAIN_KINDS.Floor,
    height: chunk.height[index] ?? 0,
  };
}

function isChunkCell(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < CHUNK_SIZE && y < CHUNK_SIZE;
}

function exteriorCell(voidTerrain: boolean): { readonly terrain: TerrainKind; readonly height: number } {
  if (voidTerrain) return { terrain: TERRAIN_KINDS.Void, height: 0 };
  return { terrain: TERRAIN_KINDS.Floor, height: ROOM_WALL_RISE };
}

function forEachChunkTile(chunk: Chunk, visit: (tile: Point) => void): void {
  const bounds = chunkBounds(chunk);
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      visit({ x, y });
    }
  }
}

function chunkBounds(chunk: Chunk) {
  const { cx, cy } = chunk;
  return {
    x: cx * CHUNK_SIZE, y: cy * CHUNK_SIZE,
    width: CHUNK_SIZE, height: CHUNK_SIZE,
  };
}

function tileKey(tile: Point): string {
  return `${tile.x},${tile.y}`;
}

function roomLabel(room: { readonly cx: number; readonly cy: number }, orientation: ViewOrientation): string {
  return `room ${room.cx},${room.cy} at orientation ${orientation}`;
}
