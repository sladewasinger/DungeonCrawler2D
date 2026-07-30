/**
 * Renderer-neutral facade for selecting the world-lighting presentation.
 * Keep shared UI consumers on this boundary so they do not pull Phaser-only
 * Toon visibility code into the Three renderer route.
 */
export {
  currentLightingMode,
  LIGHTING_MODES,
  lightingModeIsQueryForced,
  lightingModeFromQuery,
  loadPersistedLightingMode,
  parseLightingMode,
  resolveLightingMode,
  savePersistedLightingMode,
  type LightingMode,
  type LightingModeResolution,
} from "./toon/lightingMode.js";
