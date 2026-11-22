/** Shared WebGL2 MeshGeometry + Shader builder for 4 KB-per-chunk GPU tilemap layers. */
import { CHUNK_SIZE, TILE_PX } from "@dc2d/engine";
import { BufferImageSource, GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from "pixi.js";
import { TERRAIN_ATLAS_STRIDE, TERRAIN_TEX_PX, type TerrainTileAtlas } from "../textures/terrainTextures.js";
import { TILEMAP_FRAGMENT_GLSL, TILEMAP_VERTEX_GLSL } from "./glsl/tilemapGlsl.js";

export interface TilemapLayerHandle {
  readonly mesh: Mesh<MeshGeometry, Shader>;
  dispose(): void;
}

const F32 = "f32" as const;

let sharedQuad: MeshGeometry | null = null;
let sharedProgram: GlProgram | null = null;
let sharedGroundUniforms: UniformGroup | null = null;
let sharedWaterUniforms: UniformGroup | null = null;

function getSharedQuadGeometry(): MeshGeometry {
  if (sharedQuad) return sharedQuad;
  const span = CHUNK_SIZE * TILE_PX;
  sharedQuad = new MeshGeometry({
    positions: new Float32Array([0, 0, span, 0, span, span, 0, span]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  return sharedQuad;
}

export function getTilemapGlProgram(): GlProgram {
  sharedProgram ??= GlProgram.from({
    vertex: TILEMAP_VERTEX_GLSL,
    fragment: TILEMAP_FRAGMENT_GLSL,
    preferredFragmentPrecision: "highp",
  });
  return sharedProgram;
}

function getLayerUniforms(mode: "ground" | "water"): UniformGroup {
  const create = (layerMode: number) =>
    new UniformGroup({
      uChunkSize: { value: CHUNK_SIZE, type: F32 },
      uTileInner: { value: TERRAIN_TEX_PX, type: F32 },
      uTileStride: { value: TERRAIN_ATLAS_STRIDE, type: F32 },
      uLayerMode: { value: layerMode, type: F32 },
    });
  if (mode === "ground") {
    sharedGroundUniforms ??= create(0);
    return sharedGroundUniforms;
  }
  sharedWaterUniforms ??= create(1);
  return sharedWaterUniforms;
}

export function createChunkTilemapLayer(input: {
  readonly atlas: TerrainTileAtlas;
  readonly mapData: Uint8Array;
  readonly mode: "ground" | "water";
}): TilemapLayerHandle {
  const mapSource = new BufferImageSource({
    resource: input.mapData,
    width: CHUNK_SIZE,
    height: CHUNK_SIZE,
    format: "rgba8unorm",
    alphaMode: "no-premultiply-alpha",
    scaleMode: "nearest",
    addressMode: "clamp-to-edge",
  });
  const shader = new Shader({
    glProgram: getTilemapGlProgram(),
    resources: {
      uAtlas: input.atlas.gpuSheet.source,
      uChunkMap: mapSource,
      tilemapUniforms: getLayerUniforms(input.mode),
    },
  });
  const mesh = new Mesh<MeshGeometry, Shader>({
    geometry: getSharedQuadGeometry(),
    shader,
  });
  return {
    mesh,
    dispose(): void {
      mesh.destroy();
      shader.destroy(false);
      mapSource.destroy();
    },
  };
}
