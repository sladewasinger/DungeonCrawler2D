export {
  TERRAIN4,
  planTerrain4,
  type Terrain4Batches,
  type Terrain4FloorQuad,
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
  terrain4FrameFor,
  terrain4TileRoleIndex,
  type Terrain4AtlasSet,
  type Terrain4TileRole,
} from "./terrain4Tileset.js";

export { Terrain4Renderer, type TerrainRendererLike } from "./terrain4Renderer.js";
