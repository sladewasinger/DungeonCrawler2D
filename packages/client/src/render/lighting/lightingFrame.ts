import type { ViewRect } from "../terrain/streaming/streaming.js";
import { TERRAIN_PRESENTATION_MODES } from "../terrain/geometry/terrainPlannerModel.js";
import { roomTerrainPresentation } from "../terrain/runtime/roomPresentation.js";
import { lightOverlayDepth } from "./core/lightDepth.js";
import type { PlayerGroundLightAnchorSource } from "./playerGroundLightAnchor.js";

export interface LightingFrame {
  readonly view: ViewRect;
  readonly personal: PlayerGroundLightAnchorSource;
  readonly carriesTorch: boolean;
  readonly nowMs: number;
}

export interface LightingFrameState {
  readonly insideRoom: boolean;
  readonly overlayDepth: number;
}

export function lightingFrameState(frame: LightingFrame): LightingFrameState {
  return {
    insideRoom: roomTerrainPresentation(frame.personal.y).mode ===
      TERRAIN_PRESENTATION_MODES.Inside,
    overlayDepth: lightOverlayDepth(frame.view),
  };
}
