import type { DynamicLightSeed } from "./shading/tileLight.js";
import type { TilePos } from "../lighting/torches/torchPlacement.js";
import type { ViewRect } from "./streaming/streaming.js";
import type {
  WorldPresentationVisibility,
} from "../visibility/worldPresentationVisibility.js";

export interface TerrainRendererLike {
  readonly constrainedPresentation?: boolean;
  readonly submittedTerrainQuadCount?: number;
  readonly candidateTerrainQuadCount?: number;
  setWorldVisibility?(visibility: WorldPresentationVisibility | null): void;
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}
