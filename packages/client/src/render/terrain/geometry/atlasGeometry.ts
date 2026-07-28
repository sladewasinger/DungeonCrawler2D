import type { TerrainScreenPoint, TerrainScreenProjection } from "../batch/quadBatch.js";
import { terrainAtlasFrame } from "../planning/tileset.js";
import type { TerrainAtlasDraw, TerrainMeshBatch } from "../batch/atlasBatch.js";
import type { TerrainAtlasRenderOptions } from "../batch/atlasBatch.js";
import { depthForOccluder } from "../../entities/presentation/depthSort.js";
import type { TerrainBatches, TerrainQuadVertices } from "./terrainPlannerModel.js";
import { TERRAIN_TILESETS, terrainAtlasFrameName } from "../planning/tileset.js";

const ATLAS_UV_INSET_PX = 0.5;

export function appendMeshQuad(batch: TerrainMeshBatch, draw: TerrainAtlasDraw, image: { readonly width: number; readonly height: number }): void {
  const frame = terrainAtlasFrame({ set: draw.atlas, role: draw.role, variant: draw.variant, image });
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
  target: TerrainAtlasDraw[],
  quads: TerrainBatches["southFaces"],
  options: TerrainAtlasRenderOptions,
): void {
  for (const quad of quads) appendSouthFaceQuad(target, quad, options);
}

function appendSouthFaceQuad(target: TerrainAtlasDraw[], quad: TerrainBatches["southFaces"][number], options: TerrainAtlasRenderOptions): void {
  const atlas = options.debug ? TERRAIN_TILESETS.debug : TERRAIN_TILESETS[options.biomeAt(quad.worldTile)];
  const request = { target, quad, atlas, projection: options.projection };
  if (quad.southNeighborIsStair === true) {
    appendTopAlignedSegments(request);
    return;
  }
  appendBottomAlignedSegments(request);
}

interface SouthFaceDrawRequest {
  readonly target: TerrainAtlasDraw[];
  readonly quad: TerrainBatches["southFaces"][number];
  readonly atlas: SouthFaceSegmentRequest["atlas"];
  readonly projection: TerrainScreenProjection;
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
  readonly quad: TerrainBatches["southFaces"][number];
  readonly atlas: (typeof TERRAIN_TILESETS)[keyof typeof TERRAIN_TILESETS];
  readonly bottom: number;
  readonly height: number;
  readonly projection: TerrainScreenProjection;
}

function appendSouthFaceSegment(target: TerrainAtlasDraw[], request: SouthFaceSegmentRequest): void {
  const { quad, atlas, bottom, height, projection } = request;
  const uvCrop = height >= 1 - FACE_TILE_HEIGHT_EPSILON ? undefined : { top: 0, bottom: height };
  const role = quad.stairWall === true ? "stair-wall-face" : "south-face";
  target.push({ atlas, frame: terrainAtlasFrameName(atlas, role, 0), role, variant: 0,
    phase: 2, depth: depthForOccluder(quad.viewTile.y + 1), ...(uvCrop === undefined ? {} : { uvCrop }),
    points: projectQuad(southFaceSegment(quad.vertices, bottom + height, bottom), projection) });
}

function southFaceSegment(
  vertices: TerrainQuadVertices,
  topHeight: number,
  bottomHeight: number,
): TerrainQuadVertices {
  return [
    { ...vertices[0], z: topHeight },
    { ...vertices[1], z: topHeight },
    { ...vertices[2], z: bottomHeight },
    { ...vertices[3], z: bottomHeight },
  ];
}

export function projectQuad(vertices: TerrainQuadVertices, projection: TerrainScreenProjection): readonly [TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

export function compareDraws(left: TerrainAtlasDraw, right: TerrainAtlasDraw): number {
  return left.depth - right.depth || left.phase - right.phase || left.atlas.key.localeCompare(right.atlas.key);
}

export function meshKey(batch: Pick<TerrainMeshBatch, "atlas" | "phase" | "depth">): string {
  return `${batch.depth}:${batch.phase}:${batch.atlas.key}`;
}
