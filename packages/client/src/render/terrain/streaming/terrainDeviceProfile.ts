import type Phaser from "phaser";
import { TERRAIN_RUNTIME_TUNING } from "../terrainRuntimeTuning.js";
import {
  readTerrainDeviceSignals,
  requiresConstrainedPresentation,
} from "./terrainDeviceSignals.js";

const MIB = 1024 * 1024;

export interface TerrainDeviceSignals {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly maxTouchPoints: number;
  readonly coarsePointer: boolean;
  readonly finePointer: boolean;
  readonly mobilePlatform: boolean;
  readonly logicalProcessorCount: number;
  readonly deviceMemoryGiB?: number;
  readonly maxTextureSize: number;
}

export interface TerrainVisualFeatures {
  readonly ambientOcclusion: boolean;
  readonly biomeTint: boolean;
  readonly bedrockTint: boolean;
  readonly cliffHighlights: boolean;
}

export interface TerrainDeviceProfile {
  readonly kind: "constrained" | "desktop";
  readonly activeBytes: number;
  readonly spareBytes: number;
  /** Screen tiles retained for height-projected caps and south-facing walls. */
  readonly terrainMarginTiles: number;
  /** Whole chunks retained so offscreen torch/door halos can reach the camera. */
  readonly lightLoadMarginChunks: number;
  readonly maximumPreferredPagePx: number;
  readonly visuals: TerrainVisualFeatures;
  readonly retention: TerrainRetentionProfile;
}

export interface TerrainRetentionProfile {
  readonly maxChunkPlans: number;
  readonly maxOrientationRoots: number;
  readonly maxWorldChunks: number;
}

const DESKTOP_TERRAIN_VISUALS: TerrainVisualFeatures = {
  ambientOcclusion: true,
  biomeTint: true,
  bedrockTint: true,
  cliffHighlights: true,
};

const CONSTRAINED_TERRAIN_VISUALS: TerrainVisualFeatures = {
  ambientOcclusion: false,
  biomeTint: false,
  bedrockTint: true,
  cliffHighlights: true,
};

const DESKTOP_TERRAIN_RETENTION: TerrainRetentionProfile = {
  maxChunkPlans: TERRAIN_RUNTIME_TUNING.retention.maxChunkPlans,
  maxOrientationRoots: TERRAIN_RUNTIME_TUNING.retention.maxOrientationRoots,
  maxWorldChunks: TERRAIN_RUNTIME_TUNING.retention.maxWorldChunks,
};

const CONSTRAINED_TERRAIN_RETENTION: TerrainRetentionProfile = {
  maxChunkPlans: Math.max(8, Math.floor(DESKTOP_TERRAIN_RETENTION.maxChunkPlans / 2)),
  maxOrientationRoots: 2,
  maxWorldChunks: Math.max(32, Math.floor(DESKTOP_TERRAIN_RETENTION.maxWorldChunks / 2)),
};

export const CONSTRAINED_TERRAIN_PROFILE = freezeProfile({
  kind: "constrained",
  activeBytes: 80 * MIB,
  spareBytes: 16 * MIB,
  terrainMarginTiles: 2,
  lightLoadMarginChunks: 1,
  maximumPreferredPagePx: 1024,
  visuals: CONSTRAINED_TERRAIN_VISUALS,
  retention: CONSTRAINED_TERRAIN_RETENTION,
});

export const DESKTOP_TERRAIN_PROFILE = freezeProfile({
  kind: "desktop",
  activeBytes: 160 * MIB,
  spareBytes: 32 * MIB,
  terrainMarginTiles: 2,
  lightLoadMarginChunks: 1,
  maximumPreferredPagePx: 1024,
  visuals: DESKTOP_TERRAIN_VISUALS,
  retention: DESKTOP_TERRAIN_RETENTION,
});

export function selectTerrainDeviceProfile(signals: TerrainDeviceSignals): TerrainDeviceProfile {
  return requiresConstrainedPresentation(signals)
    ? CONSTRAINED_TERRAIN_PROFILE
    : DESKTOP_TERRAIN_PROFILE;
}

export { readTerrainDeviceSignals } from "./terrainDeviceSignals.js";

export function terrainDeviceProfileForScene(scene: Phaser.Scene): TerrainDeviceProfile {
  return selectTerrainDeviceProfile(readTerrainDeviceSignals(scene));
}

function freezeProfile(profile: TerrainDeviceProfile): TerrainDeviceProfile {
  return Object.freeze({
    ...profile,
    visuals: Object.freeze({ ...profile.visuals }),
    retention: Object.freeze({ ...profile.retention }),
  });
}
