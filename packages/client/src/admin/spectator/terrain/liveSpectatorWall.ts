import type { BiomeKind } from "@dc2d/engine";
import type { TerrainSouthFaceQuad } from "../../../render/terrain/planning/terrainPlanner.js";
import {
  terrainAtlasFrame,
  TERRAIN_TILESETS,
  type TerrainTileRole,
} from "../../../render/terrain/planning/tileset.js";
import {
  terrainWallRole,
  terrainWallSegments,
} from "../../../render/terrain/material/terrainMaterialRoles.js";
import {
  liveSpectatorPoint,
  liveSpectatorPointIsVisible,
} from "../liveSpectatorView.js";
import type { LiveSpectatorTerrainInput } from "../liveSpectatorTerrain.js";

export interface LiveSpectatorWallInput {
  readonly input: LiveSpectatorTerrainInput;
  readonly quad: TerrainSouthFaceQuad;
  readonly biome: BiomeKind;
}

export function drawLiveSpectatorWall(request: LiveSpectatorWallInput): void {
  const { input, quad } = request;
  const point = liveSpectatorPoint(input.view, quad.worldTile, quad.topHeight);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize * 2)) return;
  for (const segment of terrainWallSegments(quad.bottomHeight, quad.topHeight)) {
    drawWallSegment({ ...request, segment });
  }
}

interface WallSegmentRequest extends LiveSpectatorWallInput {
  readonly segment: { readonly bottom: number; readonly height: number };
}

function drawWallSegment(request: WallSegmentRequest): void {
  const { input, quad, biome, segment } = request;
  const size = input.view.tileSize;
  const topHeight = segment.bottom + segment.height;
  const point = liveSpectatorPoint(input.view, quad.worldTile, topHeight);
  const role = terrainWallRole({
    territory: cellTerritory(input.map, quad.worldTile.x, quad.worldTile.y),
    voidWall: quad.voidWall,
    stairWall: quad.stairWall,
    wallFeature: quad.wallFeature,
  }, topHeight);
  const height = Math.max(1, segment.height * size);
  if (terrainReady(input.terrain)) {
    const frame = terrainFrame(input.terrain, role, biome);
    input.context.drawImage(input.terrain, frame.x, frame.y, frame.width, frame.height,
      point.x - size / 2, point.y + size / 2, size, height);
    return;
  }
  input.context.fillStyle = "#243043";
  input.context.fillRect(point.x - size / 2, point.y + size / 2, size, height);
}

function terrainFrame(image: HTMLImageElement, role: TerrainTileRole, biome: BiomeKind) {
  return terrainAtlasFrame({ set: TERRAIN_TILESETS[biome], role, variant: 0, image });
}

function cellTerritory(map: LiveSpectatorTerrainInput["map"], x: number, y: number): number | null {
  return map.cells.find((cell) => cell.x === x && cell.y === y)?.territory ?? null;
}

function terrainReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}
