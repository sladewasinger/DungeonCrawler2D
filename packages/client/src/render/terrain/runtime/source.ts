import { TERRAIN as WORLD_TERRAIN } from "@dc2d/engine";
import {
  TERRAIN_KINDS,
  type TerrainSource,
} from "../planning/terrainPlanner.js";
import { terrainFeatureAt, terrainPropForTile } from "../planning/tileFeatures.js";
import { roomTerrainPresentation } from "./roomPresentation.js";
import type { TerrainWorld } from "./world.js";

export function createTerrainSource(world: TerrainWorld): TerrainSource {
  return {
    voidTerrain: world.features.voidTerrain,
    terrainAt: (x, y) => world.terrainAt(x, y) === WORLD_TERRAIN.Void
      ? TERRAIN_KINDS.Void
      : TERRAIN_KINDS.Floor,
    heightAt: (x, y) => world.heightAt(x, y),
    featureFaceAt: (x, y) => world.featureFaceAt(x, y),
    featureHeightAt: (x, y) => world.featureHeightAt(x, y),
    presentationAt: (_x, y) => roomTerrainPresentation(y),
    featureAt: (x, y) => terrainFeatureAt(world, x, y),
    propAt: (x, y) => terrainPropForTile(world.featureAt(x, y)),
  };
}
