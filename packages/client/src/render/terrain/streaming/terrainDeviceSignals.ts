import type Phaser from "phaser";
import type { TerrainDeviceSignals } from "./terrainDeviceProfile.js";

interface NavigatorWithDeviceSignals extends Navigator {
  readonly deviceMemory?: number;
  readonly userAgentData?: { readonly mobile?: boolean };
}

export function readTerrainDeviceSignals(scene: Phaser.Scene): TerrainDeviceSignals {
  const deviceNavigator = navigator as NavigatorWithDeviceSignals;
  return {
    viewportWidth: scene.scale.width,
    viewportHeight: scene.scale.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    coarsePointer: pointerMatches("(pointer: coarse)"),
    finePointer: pointerMatches("(pointer: fine)"),
    mobilePlatform: isMobilePlatform(deviceNavigator),
    logicalProcessorCount: navigator.hardwareConcurrency || 8,
    ...(deviceNavigator.deviceMemory === undefined
      ? {}
      : { deviceMemoryGiB: deviceNavigator.deviceMemory }),
    maxTextureSize: reportedMaxTextureSize(scene),
  };
}

export function requiresConstrainedPresentation(signals: TerrainDeviceSignals): boolean {
  return isPhoneClassDevice(signals) || hasConstrainedHardware(signals);
}

function isPhoneClassDevice(signals: TerrainDeviceSignals): boolean {
  if (signals.maxTouchPoints === 0) return false;
  if (signals.mobilePlatform) return true;
  return signals.coarsePointer && !signals.finePointer && isNarrowHighDensity(signals);
}

function hasConstrainedHardware(signals: TerrainDeviceSignals): boolean {
  if (signals.maxTextureSize <= 2048) return true;
  const pressureSignals = [
    signals.logicalProcessorCount <= 4,
    signals.deviceMemoryGiB !== undefined && signals.deviceMemoryGiB <= 4,
    framebufferPixels(signals) >= 8_000_000,
  ];
  return pressureSignals.filter(Boolean).length >= 2;
}

function isNarrowHighDensity(signals: TerrainDeviceSignals): boolean {
  return Math.min(signals.viewportWidth, signals.viewportHeight) <= 1024 &&
    signals.devicePixelRatio >= 2;
}

function framebufferPixels(signals: TerrainDeviceSignals): number {
  return signals.viewportWidth * signals.viewportHeight * signals.devicePixelRatio ** 2;
}

function pointerMatches(query: string): boolean {
  return window.matchMedia?.(query).matches ?? false;
}

function isMobilePlatform(deviceNavigator: NavigatorWithDeviceSignals): boolean {
  if (deviceNavigator.userAgentData?.mobile === true) return true;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(deviceNavigator.userAgent);
}

function reportedMaxTextureSize(scene: Phaser.Scene): number {
  const renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!renderer.gl) return 4096;
  return Number(renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE)) || 4096;
}
