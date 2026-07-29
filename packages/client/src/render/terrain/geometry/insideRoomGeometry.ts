import type { Point } from "../../view/transform/viewTransform.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import { appendFloorArt } from "./featureArt.js";
import { appendTerrainCliffEdges } from "./cliffGeometry.js";
import {
  TERRAIN_HEIGHT_EPSILON,
  TERRAIN_KINDS,
  TERRAIN_PRESENTATION_MODES,
  type TerrainSouthFaceQuad,
} from "./terrainPlannerModel.js";
import { appendWallAmbientOcclusion } from "./wallAmbientOcclusion.js";
import { wallFeatureForFace } from "./wallFeatureGeometry.js";
import type { TerrainTileContext } from "../planning/terrainPlannerBuild.js";
import type { TerrainPlanningContext } from "../planning/terrainPlanner.js";

/** Inside rooms draw no backdrop and materialize only their screen-north wall. */
export function appendInsideVoidGeometry(
  context: TerrainPlanningContext,
  worldTile: Point,
  viewTile: Point,
): boolean {
  if (context.presentation.mode !== TERRAIN_PRESENTATION_MODES.Inside) {
    return false;
  }
  const wall = syntheticWallContext(context, worldTile, viewTile);
  if (wall) appendSyntheticWall(wall);
  return true;
}

/** Raised room shell cells are hidden unless their face points at the camera. */
export function shouldCullInsideWall(
  context: TerrainTileContext,
): boolean {
  const { mode, wallRise } = context.presentation;
  if (mode !== TERRAIN_PRESENTATION_MODES.Inside) return false;
  if (context.height < wallRise - TERRAIN_HEIGHT_EPSILON) return false;
  return !hasLowerScreenSouthFloor(context);
}

function syntheticWallContext(
  context: TerrainPlanningContext,
  worldTile: Point,
  viewTile: Point,
): TerrainTileContext | null {
  const southView = { x: viewTile.x, y: viewTile.y + 1 };
  const southWorld = viewTileToWorld(southView, context.orientation);
  if (context.source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN_KINDS.Floor) {
    return null;
  }
  const bottomHeight = context.source.heightAt(southWorld.x, southWorld.y);
  const { wallRise } = context.presentation;
  if (!Number.isFinite(bottomHeight) || bottomHeight >= wallRise - TERRAIN_HEIGHT_EPSILON) {
    return null;
  }
  return {
    ...context,
    worldTile,
    viewTile,
    height: bottomHeight + wallRise,
  };
}

function appendSyntheticWall(context: TerrainTileContext): void {
  const { worldTile, viewTile, height, batches } = context;
  const bottomHeight = height - context.presentation.wallRise;
  const vertices = topQuad(viewTile, height);
  appendFloorArt({ ...context, vertices });
  appendTerrainCliffEdges(context, batches.cliffEdges);
  const wallFeature = wallFeatureForFace({
    source: context.source,
    worldTile,
    terrainTop: height,
    terrainBottom: bottomHeight,
    orientation: context.orientation,
  });
  const face: TerrainSouthFaceQuad = {
    kind: "south-face",
    worldTile,
    viewTile,
    topHeight: height,
    bottomHeight,
    ...(wallFeature ? { wallFeature } : {}),
    vertices: southFaceQuad(viewTile, height, bottomHeight),
  };
  batches.southFaces.push(face);
  appendWallAmbientOcclusion({
    source: context.source,
    orientation: context.orientation,
    face,
  }, batches.ao);
}

function hasLowerScreenSouthFloor(context: TerrainTileContext): boolean {
  const south = viewTileToWorld({
    x: context.viewTile.x,
    y: context.viewTile.y + 1,
  }, context.orientation);
  if (context.source.terrainAt(south.x, south.y) !== TERRAIN_KINDS.Floor) {
    return false;
  }
  const southHeight = context.source.heightAt(south.x, south.y);
  return Number.isFinite(southHeight) &&
    context.height - southHeight > TERRAIN_HEIGHT_EPSILON;
}

function topQuad(tile: Point, height: number) {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ] as const;
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number) {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight },
    { x: tile.x, y: southY, z: bottomHeight },
  ] as const;
}
