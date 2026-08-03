import {
  LIGHTING_VISUAL_STYLE,
  lightingColor,
} from "./lightingVisualStyle.js";
import type { LightSource } from "./core/lightSource.js";

export type MutableLightSource = {
  -readonly [Key in keyof LightSource]: LightSource[Key];
};

export const LIGHT_LOAD_MARGIN_CHUNKS =
  LIGHTING_VISUAL_STYLE.streaming.loadMarginChunks;
export const LIGHT_SCAN_BUDGET =
  LIGHTING_VISUAL_STYLE.streaming.maximumChunkScansPerUpdate;
export const MAXIMUM_ACTIVE_LIGHTS =
  LIGHTING_VISUAL_STYLE.streaming.maximumActiveLights;
export const PORTAL_LIGHT_COLOR =
  lightingColor(LIGHTING_VISUAL_STYLE.portal.color);
export const PORTAL_LIGHT_RADIUS_TILES =
  LIGHTING_VISUAL_STYLE.portal.radiusTiles;
export const PERSONAL_LIGHT_COLOR =
  lightingColor(LIGHTING_VISUAL_STYLE.personal.color);
export const PERSONAL_LIGHT_RADIUS_TILES =
  LIGHTING_VISUAL_STYLE.personal.radiusTiles;

export function createPersonalLight(): MutableLightSource {
  return {
    id: "personal",
    x: 0,
    y: 0,
    color: PERSONAL_LIGHT_COLOR,
    radiusTiles: PERSONAL_LIGHT_RADIUS_TILES,
    kind: "personal",
    seed: 0,
    groundHeight: 0,
  };
}
