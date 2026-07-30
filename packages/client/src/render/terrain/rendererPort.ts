import type { DynamicLightSeed } from "./shading/tileLight.js";
import type { TilePos } from "../lighting/torches/torchPlacement.js";
import type { ViewRect } from "./streaming/streaming.js";

export interface TerrainRendererLike {
  readonly constrainedPresentation?: boolean;
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}
