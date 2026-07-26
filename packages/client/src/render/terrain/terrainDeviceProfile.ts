import type Phaser from "phaser";

const MIB = 1024 * 1024;

export interface TerrainDeviceSignals {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly maxTouchPoints: number;
  readonly deviceMemoryGiB?: number;
  readonly maxTextureSize: number;
}

export interface TerrainDeviceProfile {
  readonly kind: "constrained" | "desktop";
  readonly activeBytes: number;
  readonly spareBytes: number;
  readonly loadMarginChunks: number;
  readonly maximumPreferredPagePx: number;
}

export const CONSTRAINED_TERRAIN_PROFILE: TerrainDeviceProfile = {
  kind: "constrained",
  activeBytes: 80 * MIB,
  spareBytes: 16 * MIB,
  loadMarginChunks: 0,
  maximumPreferredPagePx: 1024,
};

export const DESKTOP_TERRAIN_PROFILE: TerrainDeviceProfile = {
  kind: "desktop",
  activeBytes: 160 * MIB,
  spareBytes: 32 * MIB,
  loadMarginChunks: 1,
  maximumPreferredPagePx: 1024,
};

export function selectTerrainDeviceProfile(signals: TerrainDeviceSignals): TerrainDeviceProfile {
  const framebufferPixels = signals.viewportWidth * signals.viewportHeight * signals.devicePixelRatio ** 2;
  const narrowHighDensity = Math.min(signals.viewportWidth, signals.viewportHeight) <= 1024 &&
    signals.devicePixelRatio >= 2;
  const constrained = signals.maxTouchPoints > 0 ||
    (signals.deviceMemoryGiB !== undefined && signals.deviceMemoryGiB <= 4) ||
    signals.maxTextureSize < 4096 ||
    framebufferPixels >= 8_000_000 ||
    narrowHighDensity;
  return constrained ? CONSTRAINED_TERRAIN_PROFILE : DESKTOP_TERRAIN_PROFILE;
}

export function readTerrainDeviceSignals(scene: Phaser.Scene): TerrainDeviceSignals {
  const memoryNavigator = navigator as Navigator & { readonly deviceMemory?: number };
  return {
    viewportWidth: scene.scale.width,
    viewportHeight: scene.scale.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    ...(memoryNavigator.deviceMemory === undefined ? {} : { deviceMemoryGiB: memoryNavigator.deviceMemory }),
    maxTextureSize: reportedMaxTextureSize(scene),
  };
}

function reportedMaxTextureSize(scene: Phaser.Scene): number {
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!renderer.gl) return 4096;
  return Number(renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE)) || 4096;
}
