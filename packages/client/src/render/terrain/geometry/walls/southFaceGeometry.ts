import type { Point } from "../../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../../view/transform/viewTransform.js";
import type { TerrainPlanningContext } from "../../planning/terrainPlanner.js";
import { appendWallAmbientOcclusion } from "../wallAmbientOcclusion.js";
import { wallFeatureForFace } from "../wallFeatureGeometry.js";
import {
  TERRAIN_HEIGHT_EPSILON,
  TERRAIN_KINDS,
  VOID_SOUTH_FACE_MODES,
  type TerrainFeatureKind,
  type TerrainQuadVertices,
  type TerrainSouthFaceQuad,
} from "../terrainPlannerModel.js";

const VOID_FACE_DEPTH = 1;

export interface TerrainTileContext extends TerrainPlanningContext {
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly height: number;
}

export function appendScreenSouthFace(context: TerrainTileContext): void {
  const southView = { x: context.viewTile.x, y: context.viewTile.y + 1 };
  const southWorld = viewTileToWorld(southView, context.orientation);
  if (context.source.isInBoundsAt?.(southWorld.x, southWorld.y) === false) return;
  const southTerrain = context.source.terrainAt(southWorld.x, southWorld.y);
  if (southTerrain === TERRAIN_KINDS.Void) {
    appendVoidSouthFace(context);
    return;
  }
  if (southTerrain === TERRAIN_KINDS.Floor) appendFloorSouthFace(context, southWorld);
}

export function finiteTerrainHeight(context: TerrainPlanningContext, tile: Point): number {
  const height = context.source.heightAt(tile.x, tile.y);
  if (!Number.isFinite(height)) throw new Error(`Floor at (${tile.x}, ${tile.y}) has a non-finite height`);
  return height;
}

function appendVoidSouthFace(context: TerrainTileContext): void {
  if (context.presentation.mode === "inside") return;
  if (context.source.voidBoundaryAt?.(context.worldTile.x, context.worldTile.y) === "flat") return;
  const bottomHeight = context.height - VOID_FACE_DEPTH;
  const presentation = voidSouthFacePresentation(context, bottomHeight);
  if (!presentation) return;
  appendSouthFace(context, bottomHeight, presentation);
}

function voidSouthFacePresentation(
  context: TerrainTileContext,
  bottomHeight: number,
): Pick<TerrainSouthFaceQuad, "voidWall" | "stairWall" | "wallFeature"> | null {
  if (context.source.voidSouthFaceMode !== VOID_SOUTH_FACE_MODES.OpenEdges) {
    return { voidWall: true };
  }
  const stairWall = featureAt(context, context.worldTile) === "stairs";
  const wallFeature = wallFeatureForFace({
    source: context.source, worldTile: context.worldTile,
    terrainTop: context.height, terrainBottom: bottomHeight,
    orientation: context.orientation,
  });
  const authored = context.source.voidBoundaryAt?.(
    context.worldTile.x, context.worldTile.y,
  ) === "floating";
  if (!authored && !stairWall && !wallFeature) return null;
  if (wallFeature) return { wallFeature };
  if (stairWall) return { stairWall: true };
  return { voidWall: true };
}

function appendFloorSouthFace(context: TerrainTileContext, southWorld: Point): void {
  const bottomHeight = finiteTerrainHeight(context, southWorld);
  if (context.height - bottomHeight <= TERRAIN_HEIGHT_EPSILON) return;
  const stairWall = featureAt(context, context.worldTile) === "stairs";
  const wallFeature = wallFeatureForFace({
    source: context.source, worldTile: context.worldTile,
    terrainTop: context.height, terrainBottom: bottomHeight,
    orientation: context.orientation,
  });
  appendSouthFace(context, bottomHeight, {
    stairWall, ...(wallFeature ? { wallFeature } : {}),
  });
}

function appendSouthFace(
  context: TerrainTileContext,
  bottomHeight: number,
  presentation: Pick<TerrainSouthFaceQuad, "voidWall" | "stairWall" | "wallFeature">,
): void {
  const face: TerrainSouthFaceQuad = {
    kind: "south-face", worldTile: context.worldTile, viewTile: context.viewTile,
    topHeight: context.height, bottomHeight, ...presentation,
    vertices: southFaceQuad(context.viewTile, context.height, bottomHeight),
  };
  context.batches.southFaces.push(face);
  appendWallAmbientOcclusion({
    source: context.source, orientation: context.orientation, face,
  }, context.batches.ao);
}

function featureAt(context: TerrainPlanningContext, tile: Point): TerrainFeatureKind | null {
  return context.source.featureAt?.(tile.x, tile.y) ?? null;
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number): TerrainQuadVertices {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight }, { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight }, { x: tile.x, y: southY, z: bottomHeight },
  ];
}
