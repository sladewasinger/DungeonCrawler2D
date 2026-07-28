import { CHUNK_SIZE, TERRAIN, TILE, TOPOLOGY, type Chunk } from "../core/types.js";
import { DEFAULT_WORLD_FEATURES, type WorldFeatures } from "../core/worldFeatures.js";

const FIRST_DISCRETE_FEATURE_TILE = TILE.DoorPersonal;
const LAST_DISCRETE_FEATURE_TILE = TILE.DoorSafeRoom;

export interface GeneratedTerrain {
  readonly tiles: Uint8Array;
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
    height: new Float32Array(cells),
    zones: new Uint8Array(cells),
  };
  for (let index = 0; index < cells; index++) writeRuntimeCell(chunk, source, index);
  return chunk;
}

function writeRuntimeCell(chunk: Chunk, source: GeneratedTerrain, index: number): void {
  const sourceTile = source.tiles[index] ?? TILE.Floor;
  const voidCell = isVoidSource(
    sourceTile,
    source.worldFeatures?.voidTerrain ?? DEFAULT_WORLD_FEATURES.voidTerrain,
  );
  chunk.tiles[index] = runtimeTile(sourceTile, voidCell);
  chunk.terrain[index] = voidCell ? TERRAIN.Void : TERRAIN.Floor;
  chunk.features[index] = featureTile(sourceTile);
  chunk.height[index] = voidCell ? 0 : source.height[index] ?? 0;
  chunk.zones[index] = source.zones[index] ?? 0;
}

function runtimeTile(tile: number, voidCell: boolean): number {
  if (voidCell) return TILE.Void;
  return tile === TOPOLOGY.Uncarved ? TILE.Floor : tile;
}

function featureTile(tile: number): number {
  return tile === TILE.Stairs || isDiscreteFeature(tile) ? tile : TILE.Floor;
}

function isDiscreteFeature(tile: number): boolean {
  return tile >= FIRST_DISCRETE_FEATURE_TILE && tile <= LAST_DISCRETE_FEATURE_TILE;
}

function isVoidSource(tile: number, voidTerrain: boolean): boolean {
  if (tile === TILE.Void && !voidTerrain) {
    throw new Error("Explicit VOID source leaked into disabled world generation");
  }
  return tile === TILE.Void || (voidTerrain && tile === TOPOLOGY.Uncarved);
}
