import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { viewToWorld } from "../../view/transform/viewTransform.js";
import { PlayerGroundLightPass } from "../ground/playerGroundLightPass.js";
import { MAXIMUM_ACTIVE_LIGHTS } from "../lightingRuntimeStyle.js";
import { selectFrameLights } from "../torches/frameLights.js";
import type { LightSource } from "./lightSource.js";
import { lightOverlayDepth } from "./lightDepth.js";
import { LightSpritePool } from "./pool.js";

export interface ClassicLightFrameInput {
  readonly pool: LightSpritePool;
  readonly groundLight: PlayerGroundLightPass;
  readonly view: ViewRect;
  readonly personal: Readonly<{ x: number; y: number }>;
  readonly personalLight: LightSource | null;
  readonly nowMs: number;
  readonly chunkLights: Iterable<readonly LightSource[]>;
  readonly accentLights: readonly LightSource[];
  readonly candidates: LightSource[];
  readonly selected: LightSource[];
}

/** Preserves classic halo selection while keeping the facade focused on mode switching. */
export function syncClassicLightFrame(input: ClassicLightFrameInput): void {
  input.groundLight.update(input.personal.x, input.personal.y, input.nowMs);
  const lights = selectFrameLights({
    chunkLights: input.chunkLights,
    accentLights: input.accentLights,
    center: lightFrameCenter(input.view),
    personalLight: input.personalLight,
    maxLights: MAXIMUM_ACTIVE_LIGHTS,
    candidates: input.candidates,
    selected: input.selected,
  });
  input.pool.sync({
    lights,
    nowMs: input.nowMs,
    overlayDepth: lightOverlayDepth(input.view),
  });
}

function lightFrameCenter(view: ViewRect): Readonly<{ x: number; y: number }> {
  const center = {
    x: (view.x + view.width / 2) / SCREEN_TILE_PX,
    y: (view.y + view.height / 2) / SCREEN_TILE_PX,
  };
  return viewToWorld(center, getViewOrientation());
}
