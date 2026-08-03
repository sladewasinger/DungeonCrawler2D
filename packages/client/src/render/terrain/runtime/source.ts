import {
  CHUNK_SIZE,
  TERRAIN as WORLD_TERRAIN,
  TILE,
  isRoomIsolationChunk,
} from "@dc2d/engine";
import {
  TERRAIN_KINDS,
  TERRAIN_SURFACES,
  type TerrainSource,
} from "../planning/terrainPlanner.js";
import { terrainFeatureAt, terrainPropForTile } from "../planning/tileFeatures.js";
import { roomTerrainPresentation } from "./roomPresentation.js";
import type { TerrainWorld } from "./world.js";

export function createTerrainSource(world: TerrainWorld): TerrainSource {
  const finiteBounds = terrainBounds(world.floorBounds);
  return {
    voidTerrain: world.features.voidTerrain,
    cacheIdentity: terrainCacheIdentity(world),
    ...(finiteBounds ? { finiteBounds } : {}),
    ...(world.stairTreadCount === undefined ? {} : { stairTreadCount: world.stairTreadCount }),
    territoryAt: (x, y) => world.territoryAtWorldTile?.(x, y) ?? null,
    isInBoundsAt: (x, y) => isRoomIsolationChunk(Math.floor(y / CHUNK_SIZE)) ||
      (finiteBounds ? pointInside(finiteBounds, x, y) : true),
    allowsVoidAt: (_x, y) => isRoomIsolationChunk(Math.floor(y / CHUNK_SIZE)),
    terrainAt: (x, y) => world.terrainAt(x, y) === WORLD_TERRAIN.Void
      ? TERRAIN_KINDS.Void
      : TERRAIN_KINDS.Floor,
    surfaceAt: (x, y) => {
      const tile = world.surfaceTileAt?.(x, y) ?? world.tileAt(x, y);
      return tile === TILE.Bedrock
        ? TERRAIN_SURFACES.Bedrock
        : TERRAIN_SURFACES.Floor;
    },
    heightAt: (x, y) => world.heightAt(x, y),
    featureFaceAt: (x, y) => world.featureFaceAt(x, y),
    featureHeightAt: (x, y) => world.featureHeightAt(x, y),
    presentationAt: (_x, y) => roomTerrainPresentation(y),
    featureAt: (x, y) => terrainFeatureAt(world, x, y),
    propAt: (x, y) => terrainPropForTile(world.featureAt(x, y)),
  };
}

function terrainCacheIdentity(world: TerrainWorld): string {
  const identity = world.floorIdentity;
  if (!identity || world.worldSeed === undefined || world.floor === undefined) return "legacy";
  return [world.worldSeed, world.floor, identity.configurationFingerprint, identity.fingerprint].join(":");
}

function terrainBounds(bounds: TerrainWorld["floorBounds"]): { x: number; y: number; width: number; height: number } | undefined {
  if (!bounds) return undefined;
  return { x: bounds.minX, y: bounds.minY, width: bounds.width, height: bounds.height };
}

function pointInside(bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, x: number, y: number): boolean {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}
