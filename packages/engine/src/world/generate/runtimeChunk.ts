import {
  BEDROCK_MIN_HEIGHT,
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
  TOPOLOGY,
  type Chunk,
} from "../core/types.js";
import { DEFAULT_WORLD_FEATURES, type WorldFeatures } from "../core/worldFeatures.js";

export interface GeneratedTerrain {
  readonly tiles: Uint8Array;
  readonly featureTiles?: Uint8Array;
  readonly featureFaces?: Uint8Array;
  readonly featureHeight?: Float32Array;
  readonly height: Float32Array;
  readonly zones: Uint8Array;
  readonly worldFeatures?: WorldFeatures;
}

/** Convert the direct 32×32 topology grid into the runtime terrain/feature planes. */
export function buildRuntimeChunk(cx: number, cy: number, source: GeneratedTerrain): Chunk {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  const chunk: Chunk = {
    cx,
    cy,
    tiles: new Uint8Array(cells),
    terrain: new Uint8Array(cells),
    features: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells),
    height: new Float32Array(cells),
    zones: new Uint8Array(cells),
  };
  for (let index = 0; index < cells; index++) writeRuntimeCell(chunk, source, index);
  return chunk;
}

function writeRuntimeCell(chunk: Chunk, source: GeneratedTerrain, index: number): void {
  const sourceTile = source.tiles[index] ?? TILE.Floor;
  const sourceHeight = source.height[index] ?? 0;
  assertBedrockHeight(sourceTile, sourceHeight, index);
  const voidCell = isVoidSource(
    sourceTile,
    source.worldFeatures?.voidTerrain ?? DEFAULT_WORLD_FEATURES.voidTerrain,
  );
  chunk.tiles[index] = runtimeTile(sourceTile, voidCell);
  chunk.terrain[index] = voidCell ? TERRAIN.Void : TERRAIN.Floor;
  chunk.features[index] = runtimeFeature(source, sourceTile, index);
  chunk.featureFaces[index] = runtimeFeatureFace(source, index);
  chunk.featureHeight[index] = runtimeFeatureHeight(source, index);
  chunk.height[index] = voidCell ? 0 : sourceHeight;
  chunk.zones[index] = source.zones[index] ?? 0;
}

function assertBedrockHeight(
  tile: number,
  height: number,
  index: number,
): void {
  if (tile === TILE.Bedrock && height < BEDROCK_MIN_HEIGHT) {
    throw new Error(`Bedrock cell ${index} is below z${BEDROCK_MIN_HEIGHT}`);
  }
}

function runtimeTile(tile: number, voidCell: boolean): number {
  if (voidCell) return TILE.Void;
  if (isDiscreteFeature(tile)) return TILE.Floor;
  return tile === TOPOLOGY.Uncarved ? TILE.Floor : tile;
}

function extractedFeature(tile: number): number {
  return tile === TILE.Stairs || isDiscreteFeature(tile) ? tile : TILE.Floor;
}

function runtimeFeature(source: GeneratedTerrain, sourceTile: number, index: number): number {
  return source.featureTiles?.[index] || extractedFeature(sourceTile);
}

function runtimeFeatureFace(source: GeneratedTerrain, index: number): number {
  return source.featureFaces?.[index] ?? FEATURE_FACE.Top;
}

function runtimeFeatureHeight(source: GeneratedTerrain, index: number): number {
  const explicitFeature = source.featureTiles?.[index] ?? TILE.Floor;
  if (explicitFeature !== TILE.Floor) return authoredFeatureHeight(source, index);
  const sourceTile = source.tiles[index] ?? TILE.Floor;
  return extractedFeature(sourceTile) === TILE.Floor ? 0 : terrainHeight(source, index);
}

function authoredFeatureHeight(source: GeneratedTerrain, index: number): number {
  return source.featureHeight?.[index] ?? terrainHeight(source, index);
}

function terrainHeight(source: GeneratedTerrain, index: number): number {
  return source.height[index] ?? 0;
}

function isDiscreteFeature(tile: number): boolean {
  return tile === TILE.ArenaGate ||
    (tile >= TILE.DoorPersonal && tile <= TILE.DoorSafeRoom);
}

function isVoidSource(tile: number, voidTerrain: boolean): boolean {
  if (tile === TILE.Void && !voidTerrain) {
    throw new Error("Explicit VOID source leaked into disabled world generation");
  }
  return tile === TILE.Void || (voidTerrain && tile === TOPOLOGY.Uncarved);
}
