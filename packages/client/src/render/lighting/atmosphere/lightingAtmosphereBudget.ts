import type { TerrainDeviceProfile } from "../../terrain/streaming/terrainDeviceProfile.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const DARKNESS = LIGHTING_VISUAL_STYLE.darkness;
const FOG = LIGHTING_VISUAL_STYLE.fog;
const ATMOSPHERE = LIGHTING_VISUAL_STYLE.atmosphere;

export interface LightingAtmosphereBudget {
  readonly darknessDownscale: number;
  readonly fogLayerCount: number;
  readonly maximumRevealLights: number;
  readonly maximumRevealCells: number;
  readonly maximumParticles: number;
}

/** Fixed ceilings make the atmosphere predictable on both desktop and touch devices. */
export function lightingAtmosphereBudget(
  profile: TerrainDeviceProfile["kind"],
  reducedMotion: boolean,
): LightingAtmosphereBudget {
  const constrained = profile === "constrained";
  return {
    darknessDownscale: constrained
      ? DARKNESS.constrainedDownscale
      : DARKNESS.desktopDownscale,
    fogLayerCount: fogLayerCount(constrained, reducedMotion),
    maximumRevealLights: DARKNESS.maximumRevealLights,
    maximumRevealCells: maximumRevealCells(constrained),
    maximumParticles: maximumParticles(constrained, reducedMotion),
  };
}

function fogLayerCount(constrained: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  return constrained ? FOG.constrainedLayerCount : FOG.desktopLayerCount;
}

function maximumRevealCells(constrained: boolean): number {
  return constrained
    ? DARKNESS.constrainedMaximumRevealCells
    : DARKNESS.desktopMaximumRevealCells;
}

function maximumParticles(
  constrained: boolean,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  return constrained
    ? ATMOSPHERE.constrainedMaximumParticles
    : ATMOSPHERE.desktopMaximumParticles;
}

export function reducedMotionPreferred(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
