export interface TerrainCell {
  readonly x: number;
  readonly z: number;
}

export interface TerrainBlock extends TerrainCell {
  readonly material: unknown;
  readonly top: number;
}

export interface TerrainTile extends TerrainCell {
  readonly height: number;
  readonly tile: number;
}
