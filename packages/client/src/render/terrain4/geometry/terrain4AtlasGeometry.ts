import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "../batch/phaser4QuadBatch.js";
import {
  terrain4AtlasFrame,
  terrain4CliffAtlasFrame,
  type Terrain4CliffTileRole,
  type Terrain4TileRole,
} from "../planning/terrain4Tileset.js";
import type { Terrain4AtlasDraw, Terrain4MeshBatch } from "../batch/phaser4AtlasBatch.js";
import type { Terrain4AtlasRenderOptions } from "../batch/phaser4AtlasBatch.js";
import { depthForCapOccluder, depthForOccluder } from "../../entities/presentation/depthSort.js";
import { TERRAIN4_CLIFFS, type Terrain4Batches } from "./terrainPlannerModel.js";
import { TERRAIN4_CLIFF_TILESETS, TERRAIN4_TILESETS, terrain4AtlasFrameName, terrain4CliffAtlasFrameName } from "../planning/terrain4Tileset.js";
import type { Terrain4QuarterTurn, Terrain4QuadVertices } from "./terrainPlannerModel.js";

export function appendMeshQuad(batch: Terrain4MeshBatch, draw: Terrain4AtlasDraw, image: { readonly width: number; readonly height: number }): void {
  const frame = "columns" in draw.atlas
    ? terrain4CliffAtlasFrame({ set: draw.atlas, role: draw.role as Terrain4CliffTileRole, variant: draw.variant, image })
    : terrain4AtlasFrame({ set: draw.atlas, role: draw.role as Terrain4TileRole, variant: draw.variant, image });
  const base = batch.vertices.length / 4;
  const u0 = frame.x / image.width;
  // Phaser's Mesh2D samples V from the opposite edge of a PNG frame. Keep the
  // logical top/bottom crop names, but invert the normalized frame coordinates
  // once here so every atlas role is upright. This also makes a partial face
  // show the source tile's top portion, truncating its bottom.
  const cropTop = draw.uvCrop?.top ?? 0;
  const cropBottom = draw.uvCrop?.bottom ?? 1;
  const v0 = (frame.y + frame.height * (1 - cropTop)) / image.height;
  const u1 = (frame.x + frame.width) / image.width;
  const v1 = (frame.y + frame.height * (1 - cropBottom)) / image.height;
  const [topLeft, topRight, bottomRight, bottomLeft] = draw.points;
  const uv = rotatedUVs({ u0, v0, u1, v1, rotation: draw.rotation ?? 0 });
  batch.vertices.push(
    topLeft.x, topLeft.y, uv[0]![0], uv[0]![1], topRight.x, topRight.y, uv[1]![0], uv[1]![1],
    bottomRight.x, bottomRight.y, uv[2]![0], uv[2]![1], bottomLeft.x, bottomLeft.y, uv[3]![0], uv[3]![1],
  );
  batch.indices.push(base, base + 1, base + 2, 0, base, base + 2, base + 3, 0);
}

export function appendCliffDraws(target: Terrain4AtlasDraw[], quads: Terrain4Batches["cliffEdges"], options: Terrain4AtlasRenderOptions): void {
  for (const quad of quads) appendCliffDraw(target, quad, options);
}

function appendCliffDraw(target: Terrain4AtlasDraw[], quad: Terrain4Batches["cliffEdges"][number], options: Terrain4AtlasRenderOptions): void {
  const set = options.debug ? TERRAIN4_CLIFF_TILESETS.debug : TERRAIN4_CLIFF_TILESETS[options.biomeAt(quad.worldTile)];
  const role: Terrain4CliffTileRole = quad.cliff === TERRAIN4_CLIFFS.Corner ? "cliff-corner" : "cliff-middle";
  const variant = set.rowCount === 1 ? 0 : terrain4Variant(quad.worldTile.x, quad.worldTile.y);
  target.push({ atlas: set, frame: terrain4CliffAtlasFrameName(set, role, variant), role, variant, phase: 1,
    depth: depthForCapOccluder(quad.viewTile.y), rotation: quad.rotation,
    points: projectQuad(quad.vertices, options.projection) });
}

const FACE_TILE_HEIGHT_EPSILON = 1e-6;

/** Emits one source tile per vertical wall unit, cropping only the final partial tile. */
export function appendSouthFaceDraws(
  target: Terrain4AtlasDraw[],
  quads: Terrain4Batches["southFaces"],
  options: Terrain4AtlasRenderOptions,
): void {
  for (const quad of quads) appendSouthFaceQuad(target, quad, options);
}

function appendSouthFaceQuad(target: Terrain4AtlasDraw[], quad: Terrain4Batches["southFaces"][number], options: Terrain4AtlasRenderOptions): void {
  const atlas = options.debug ? TERRAIN4_TILESETS.debug : TERRAIN4_TILESETS[options.biomeAt(quad.worldTile)];
  const variant = terrain4Variant(quad.worldTile.x, quad.worldTile.y);
  let bottom = quad.bottomHeight;
  for (let remaining = quad.topHeight - bottom; remaining > FACE_TILE_HEIGHT_EPSILON;) {
    const height = Math.min(1, remaining);
    appendSouthFaceSegment(target, { quad, atlas, variant, bottom, height, projection: options.projection });
    bottom += height;
    remaining -= height;
  }
}

interface SouthFaceSegmentRequest {
  readonly quad: Terrain4Batches["southFaces"][number];
  readonly atlas: (typeof TERRAIN4_TILESETS)[keyof typeof TERRAIN4_TILESETS];
  readonly variant: 0 | 1;
  readonly bottom: number;
  readonly height: number;
  readonly projection: Terrain4ScreenProjection;
}

function appendSouthFaceSegment(target: Terrain4AtlasDraw[], request: SouthFaceSegmentRequest): void {
  const { quad, atlas, variant, bottom, height, projection } = request;
  const uvCrop = height >= 1 - FACE_TILE_HEIGHT_EPSILON ? undefined : { top: 0, bottom: height };
  target.push({ atlas, frame: terrain4AtlasFrameName(atlas, "south-face", variant), role: "south-face", variant,
    phase: 2, depth: depthForOccluder(quad.viewTile.y + 1), ...(uvCrop === undefined ? {} : { uvCrop }),
    points: projectQuad(southFaceSegment(quad.vertices, bottom + height, bottom), projection) });
}

function southFaceSegment(
  vertices: Terrain4QuadVertices,
  topHeight: number,
  bottomHeight: number,
): Terrain4QuadVertices {
  return [
    { ...vertices[0], z: topHeight },
    { ...vertices[1], z: topHeight },
    { ...vertices[2], z: bottomHeight },
    { ...vertices[3], z: bottomHeight },
  ];
}

interface UvBounds {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly rotation: Terrain4QuarterTurn;
}

function rotatedUVs({ u0, v0, u1, v1, rotation }: UvBounds): readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]] {
  switch (rotation) {
    case 90: return [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];
    case 180: return [[u1, v1], [u0, v1], [u0, v0], [u1, v0]];
    case 270: return [[u1, v0], [u1, v1], [u0, v1], [u0, v0]];
    default: return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  }
}

export function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

export function terrain4Variant(x: number, y: number): 0 | 1 {
  return Math.abs(x * 31 + y * 17) % 2 as 0 | 1;
}

export function compareDraws(left: Terrain4AtlasDraw, right: Terrain4AtlasDraw): number {
  return left.depth - right.depth || left.phase - right.phase || left.atlas.key.localeCompare(right.atlas.key);
}

export function meshKey(batch: Pick<Terrain4MeshBatch, "atlas" | "phase" | "depth">): string {
  return `${batch.depth}:${batch.phase}:${batch.atlas.key}`;
}
