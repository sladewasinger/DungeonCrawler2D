import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "../batch/phaser4QuadBatch.js";
import { terrain4AtlasFrame } from "../planning/terrain4Tileset.js";
import type { Terrain4AtlasDraw, Terrain4MeshBatch } from "../batch/phaser4AtlasBatch.js";
import type { Terrain4AtlasRenderOptions } from "../batch/phaser4AtlasBatch.js";
import { depthForOccluder } from "../../entities/presentation/depthSort.js";
import type { Terrain4Batches, Terrain4QuadVertices } from "./terrainPlannerModel.js";
import { TERRAIN4_TILESETS, terrain4AtlasFrameName } from "../planning/terrain4Tileset.js";

const ATLAS_UV_INSET_PX = 0.5;

export function appendMeshQuad(batch: Terrain4MeshBatch, draw: Terrain4AtlasDraw, image: { readonly width: number; readonly height: number }): void {
  const frame = terrain4AtlasFrame({ set: draw.atlas, role: draw.role, variant: draw.variant, image });
  const base = batch.vertices.length / 4;
  const u0 = (frame.x + ATLAS_UV_INSET_PX) / image.width;
  const cropTop = draw.uvCrop?.top ?? 0;
  const cropBottom = draw.uvCrop?.bottom ?? 1;
  const topPixel = frame.y + frame.height * cropTop + ATLAS_UV_INSET_PX;
  const bottomPixel = frame.y + frame.height * cropBottom - ATLAS_UV_INSET_PX;
  // Phaser's WebGL frame convention measures V upward from the PNG's bottom.
  const v0 = 1 - topPixel / image.height;
  const u1 = (frame.x + frame.width - ATLAS_UV_INSET_PX) / image.width;
  const v1 = 1 - bottomPixel / image.height;
  const [topLeft, topRight, bottomRight, bottomLeft] = draw.points;
  batch.vertices.push(
    topLeft.x, topLeft.y, u0, v0, topRight.x, topRight.y, u1, v0,
    bottomRight.x, bottomRight.y, u1, v1, bottomLeft.x, bottomLeft.y, u0, v1,
  );
  batch.indices.push(base, base + 1, base + 2, 0, base, base + 2, base + 3, 0);
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
  const request = { target, quad, atlas, projection: options.projection };
  if (quad.southNeighborIsStair === true) {
    appendTopAlignedSegments(request);
    return;
  }
  appendBottomAlignedSegments(request);
}

interface SouthFaceDrawRequest {
  readonly target: Terrain4AtlasDraw[];
  readonly quad: Terrain4Batches["southFaces"][number];
  readonly atlas: SouthFaceSegmentRequest["atlas"];
  readonly projection: Terrain4ScreenProjection;
}

function appendTopAlignedSegments(request: SouthFaceDrawRequest): void {
  const { target, quad, atlas, projection } = request;
  let top = quad.topHeight;
  for (let remaining = top - quad.bottomHeight; remaining > FACE_TILE_HEIGHT_EPSILON;) {
    const height = Math.min(1, remaining);
    appendSouthFaceSegment(target, { quad, atlas, bottom: top - height, height, projection });
    top -= height;
    remaining -= height;
  }
}

function appendBottomAlignedSegments(request: SouthFaceDrawRequest): void {
  const { target, quad, atlas, projection } = request;
  let bottom = quad.bottomHeight;
  for (let remaining = quad.topHeight - bottom; remaining > FACE_TILE_HEIGHT_EPSILON;) {
    const height = Math.min(1, remaining);
    appendSouthFaceSegment(target, { quad, atlas, bottom, height, projection });
    bottom += height;
    remaining -= height;
  }
}

interface SouthFaceSegmentRequest {
  readonly quad: Terrain4Batches["southFaces"][number];
  readonly atlas: (typeof TERRAIN4_TILESETS)[keyof typeof TERRAIN4_TILESETS];
  readonly bottom: number;
  readonly height: number;
  readonly projection: Terrain4ScreenProjection;
}

function appendSouthFaceSegment(target: Terrain4AtlasDraw[], request: SouthFaceSegmentRequest): void {
  const { quad, atlas, bottom, height, projection } = request;
  const uvCrop = height >= 1 - FACE_TILE_HEIGHT_EPSILON ? undefined : { top: 0, bottom: height };
  const role = quad.stairWall === true ? "stair-wall-face" : "south-face";
  target.push({ atlas, frame: terrain4AtlasFrameName(atlas, role, 0), role, variant: 0,
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

export function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

export function compareDraws(left: Terrain4AtlasDraw, right: Terrain4AtlasDraw): number {
  return left.depth - right.depth || left.phase - right.phase || left.atlas.key.localeCompare(right.atlas.key);
}

export function meshKey(batch: Pick<Terrain4MeshBatch, "atlas" | "phase" | "depth">): string {
  return `${batch.depth}:${batch.phase}:${batch.atlas.key}`;
}
