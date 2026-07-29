import type { TerrainType } from "@dc2d/engine";

export interface GroundLightWorld {
  terrainAt(wx: number, wy: number): TerrainType;
  groundAt(x: number, y: number): number;
}

export interface GroundLightSource {
  readonly x: number;
  readonly y: number;
  readonly radiusTiles: number;
}

export interface GroundLightCell {
  readonly tileX: number;
  readonly tileY: number;
  readonly strength: number;
  readonly groundHeight: number;
}

/** One soft darkness-mask stamp derived from a LOS-visible floor cell. */
export interface GroundLightRevealCell extends GroundLightCell {
  readonly brushRadiusTiles: number;
  readonly brushAlpha: number;
  /** Exact emitter anchor for a source reveal stamp; LOS cells use tile centers. */
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface GroundLightTile {
  readonly x: number;
  readonly y: number;
}
