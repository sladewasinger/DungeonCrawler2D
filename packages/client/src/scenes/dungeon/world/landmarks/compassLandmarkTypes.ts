import type { World } from "@dc2d/engine";

export interface CompassLandmarkPosition {
  readonly x: number;
  readonly y: number;
}

export interface CompassLandmarkPositions {
  readonly safeRoom: CompassLandmarkPosition | null;
  readonly miniBossArena: CompassLandmarkPosition | null;
}

export interface CompassLandmarkSearchRequest {
  readonly world: World;
  readonly x: number;
  readonly y: number;
  readonly defeatedMiniBossArenaChunks?: ReadonlySet<string>;
}
