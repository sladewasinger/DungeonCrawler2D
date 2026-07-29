import {
  LIGHTING_VISUAL_STYLE,
  lightingColor,
} from "./lightingVisualStyle.js";
import type { LightSource } from "./core/lightSource.js";
import { applyPlayerLightMode } from "./playerLightMode.js";

export type MutableLightSource = {
  -readonly [Key in keyof LightSource]: LightSource[Key];
};

export const LIGHT_LOAD_MARGIN_CHUNKS =
  LIGHTING_VISUAL_STYLE.streaming.loadMarginChunks;
export const MAXIMUM_ACTIVE_LIGHTS =
  LIGHTING_VISUAL_STYLE.streaming.maximumActiveLights;
export const PORTAL_LIGHT_COLOR =
  lightingColor(LIGHTING_VISUAL_STYLE.portal.color);
export const PORTAL_LIGHT_RADIUS_TILES =
  LIGHTING_VISUAL_STYLE.portal.radiusTiles;
export function createPersonalLight(): MutableLightSource {
  const light: MutableLightSource = {
    id: "personal",
    x: 0,
    y: 0,
    color: 0,
    radiusTiles: 0,
    kind: "personal",
    seed: 0,
    groundHeight: 0,
  };
  applyPlayerLightMode(light, false);
  return light;
}
