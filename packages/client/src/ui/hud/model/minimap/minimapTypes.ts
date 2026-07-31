export type MinimapEntityKind = "self" | "player" | "party" | "enemy";

export interface MinimapEntityMarker {
  readonly kind: MinimapEntityKind;
  readonly x: number;
  readonly y: number;
}

export type MinimapLandmarkKind = "safeRoom" | "miniBossArena" | "stairs";

export interface MinimapLandmarkMarker {
  readonly kind: MinimapLandmarkKind;
  readonly x: number;
  readonly y: number;
}

export interface MinimapTerrainTile {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly walkable: boolean;
}

export interface MinimapSnapshot {
  centerX: number;
  centerY: number;
  readonly rangeTiles: number;
  readonly terrain: readonly MinimapTerrainTile[];
  readonly entities: readonly MinimapEntityMarker[];
  readonly landmarks: readonly MinimapLandmarkMarker[];
}
