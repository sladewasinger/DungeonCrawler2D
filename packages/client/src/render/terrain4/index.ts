export {
  TERRAIN4,
  TERRAIN4_FEATURES,
  TERRAIN4_HEIGHT_EPSILON,
  planTerrain4,
  type Terrain4Batches,
  type Terrain4FloorQuad,
  type Terrain4FeatureQuad,
  type Terrain4FeatureKind,
  type Terrain4Kind,
  type Terrain4Plan,
  type Terrain4PlanOptions,
  type Terrain4QuadVertices,
  type Terrain4Rect,
  type Terrain4SouthFaceQuad,
  type Terrain4VoidQuad,
  type Terrain4Source,
  type Terrain4Vertex,
} from "./terrainPlanner.js";

export {
  TERRAIN4_ATLAS_COLUMNS,
  TERRAIN4_ATLAS_ROWS_PER_SET,
  TERRAIN4_TILE_ROLES,
  TERRAIN4_TILESETS,
  terrain4AtlasFrame,
  terrain4AtlasFrameName,
  terrain4FrameFor,
  terrain4TileRoleIndex,
  type Terrain4AtlasSet,
  type Terrain4AtlasFrame,
  type Terrain4TileRole,
} from "./terrain4Tileset.js";

export { Terrain4Renderer, type TerrainRendererLike } from "./terrain4Renderer.js";

export {
  Phaser4TerrainAtlasBatchRenderer,
  installTerrain4AtlasFrames,
  terrain4AtlasDraws,
  terrain4MeshBatches,
  type Terrain4AtlasDraw,
  type Terrain4AtlasRenderOptions,
  type Terrain4MeshBatch,
} from "./phaser4AtlasBatch.js";
