import { CHUNK_SIZE, FEATURE_FACE, TERRAIN, TILE, featureAnchor, isRoomIsolationChunk, type FeatureFace, type GeneratedFloor, type World } from "@dc2d/engine";
import { viewChunkWorldOrigin } from "../core/viewChunkOrigin.js";
import { hashSeed, type LightSource } from "../core/lightSource.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { FACE_MIN_DROP } from "../../terrain/geometry/faces.js";
import type { ChunkCoord } from "../../terrain/streaming/streaming.js";
import {
  doorLightPositions,
  type DoorLightMount,
} from "./doorLights.js";
import { TORCH_COLOR, TORCH_RADIUS_TILES } from "./torchLightStyle.js";
import {
  selectTorchPositions,
  torchCandidates,
  type TilePos,
  type TileRect,
} from "./torchPlacement.js";
import {
  PORTAL_LIGHT_COLOR,
  PORTAL_LIGHT_RADIUS_TILES,
} from "../lightingRuntimeStyle.js";

/** Scans one view-oriented runtime chunk for authored torch and door lights. */
export class ChunkLightScanner {
  constructor(private readonly world: World) {}

  scan(coord: ChunkCoord): LightSource[] {
    const floor = this.world.generatedFloor;
    const bounds = chunkWorldBounds(coord);
    if (floor && !isRoomIsolationChunk(Math.floor(bounds.y0 / CHUNK_SIZE))) {
      return this.scanFiniteFloor(coord, floor);
    }
    return this.scanWorld(coord);
  }

  private scanWorld(coord: ChunkCoord): LightSource[] {
    const bounds = chunkWorldBounds(coord);
    const torches = selectTorchPositions(torchCandidates(this.world, bounds))
      .map((position) => this.torchLight(position));
    const doors = doorLightPositions(this.world, bounds)
      .map((mount) => this.doorLight(mount));
    return [...torches, ...doors];
  }

  private scanFiniteFloor(coord: ChunkCoord, floor: GeneratedFloor): LightSource[] {
    const bounds = finiteChunkBounds(coord, floor);
    const torches = selectTorchPositions(finiteTorchCandidates(floor, bounds))
      .map((position) => this.torchLight(position, finiteGroundHeight(floor, position)));
    const doors = finiteDoorLightPositions(floor, bounds).map((mount) => this.doorLight(mount));
    return [...torches, ...doors];
  }

  private torchLight(position: TilePos, groundHeight = this.world.groundAt(position.wx + 0.5, position.wy + 0.5)): LightSource {
    const id = `torch:${position.wx},${position.wy}`;
    return {
      id,
      x: position.wx + 0.5,
      y: position.wy + 1.1,
      color: TORCH_COLOR,
      radiusTiles: TORCH_RADIUS_TILES,
      kind: "torch",
      seed: hashSeed(id),
      groundHeight,
    };
  }

  private doorLight(mount: DoorLightMount): LightSource {
    const id = `door:${mount.wx},${mount.wy}`;
    return {
      id,
      x: mount.x,
      y: mount.y,
      color: PORTAL_LIGHT_COLOR,
      radiusTiles: PORTAL_LIGHT_RADIUS_TILES,
      kind: "portal",
      seed: hashSeed(id),
      groundHeight: mount.projectionHeight,
    };
  }
}

interface TileBounds { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; }

function finiteChunkBounds(coord: ChunkCoord, floor: GeneratedFloor): TileBounds {
  const chunk = chunkWorldBounds(coord);
  return {
    x0: Math.max(chunk.x0, floor.bounds.minX), y0: Math.max(chunk.y0, floor.bounds.minY),
    x1: Math.min(chunk.x1, floor.bounds.maxX + 1), y1: Math.min(chunk.y1, floor.bounds.maxY + 1),
  };
}

function finiteTorchCandidates(floor: GeneratedFloor, bounds: TileBounds): TilePos[] {
  const out: TilePos[] = [];
  for (let y = bounds.y0; y < bounds.y1; y += 1) {
    for (let x = bounds.x0; x < bounds.x1; x += 1) {
      if (finiteSouthFace(floor, x, y)) out.push({ wx: x, wy: y });
    }
  }
  return out;
}

function finiteDoorLightPositions(floor: GeneratedFloor, bounds: TileBounds): DoorLightMount[] {
  const out: DoorLightMount[] = [];
  for (let y = bounds.y0; y < bounds.y1; y += 1) {
    for (let x = bounds.x0; x < bounds.x1; x += 1) {
      appendFiniteDoorLight({ out, floor, x, y });
    }
  }
  return out;
}

function appendFiniteDoorLight(input: {
  readonly out: DoorLightMount[]; readonly floor: GeneratedFloor; readonly x: number; readonly y: number;
}): void {
  const { out, floor, x, y } = input;
  const index = floorIndex(floor, x, y);
  if (index === null || !isDoor(floor.features[index] ?? TILE.Floor)) return;
  const face = floor.featureFaces[index] as FeatureFace;
  const anchor = featureAnchor({ x, y }, face);
  const featureHeight = floor.featureHeight[index] ?? 0;
  out.push({
    wx: x, wy: y, ...anchor,
    projectionHeight: face === FEATURE_FACE.Top ? featureHeight : Math.max(0, featureHeight - 0.5),
  });
}

function finiteSouthFace(floor: GeneratedFloor, x: number, y: number): boolean {
  const current = floorIndex(floor, x, y);
  const south = floorIndex(floor, x, y + 1);
  if (current === null || south === null) return false;
  if (isVoid(floor, current) || isVoid(floor, south)) return false;
  return (floor.height[current] ?? 0) - (floor.height[south] ?? 0) >= FACE_MIN_DROP;
}

function finiteGroundHeight(floor: GeneratedFloor, position: TilePos): number {
  const index = floorIndex(floor, position.wx, position.wy);
  return index === null ? 0 : (floor.height[index] ?? 0);
}

function floorIndex(floor: GeneratedFloor, x: number, y: number): number | null {
  if (x < floor.bounds.minX || x > floor.bounds.maxX || y < floor.bounds.minY || y > floor.bounds.maxY) return null;
  return (y - floor.bounds.minY) * floor.bounds.width + x - floor.bounds.minX;
}

function isVoid(floor: GeneratedFloor, index: number): boolean {
  const feature = floor.features[index] ?? TILE.Floor;
  const tile = feature !== TILE.Floor ? feature : floor.tiles[index] ?? TILE.Floor;
  return floor.terrain[index] === TERRAIN.Void || tile === TILE.Void;
}

function isDoor(tile: number): boolean {
  return tile === TILE.DoorSafeRoom || tile === TILE.DoorPersonal || tile === TILE.DoorParty || tile === TILE.DoorExit;
}

function chunkWorldBounds(coord: ChunkCoord): TileRect {
  const origin = viewChunkWorldOrigin({
    baseVX: coord.cx * CHUNK_SIZE,
    baseVY: coord.cy * CHUNK_SIZE,
    size: CHUNK_SIZE,
    orientation: getViewOrientation(),
  });
  return {
    x0: origin.x,
    y0: origin.y,
    x1: origin.x + CHUNK_SIZE,
    y1: origin.y + CHUNK_SIZE,
  };
}
