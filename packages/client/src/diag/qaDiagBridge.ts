/** Gated QA diagnostic bridge exposing live renderer, chunk, player, VRAM, and audio telemetry. */
import type { AudioEngine } from "../audio/audioEngine.js";
import type { WorldScene } from "../render/world/worldScene.js";

interface ClientDiagStats {
  readonly rendererReady: boolean;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly chunkCount: number;
  readonly playerPos: { readonly x: number; readonly y: number } | null;
  readonly shaderErrors: readonly string[];
  readonly webglContextLost: boolean;
  readonly activeTextureCount: number;
  readonly estimatedTextureBytes: number;
  readonly activeAudioNodes: number;
  readonly fpsSampleCount: number;
}

interface ClientDiagBridge {
  getStats(): ClientDiagStats;
}

declare global {
  interface Window {
    __dc2dDiag?: ClientDiagBridge;
  }
}

function isQaDiagEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get("qaDiag") === "1";
}

export function installQaDiagBridge(opts: {
  readonly scene: WorldScene;
  readonly audio?: AudioEngine | undefined;
  readonly getPlayerPos: () => { readonly x: number; readonly y: number } | null;
  readonly onFrameTick?: (() => number) | undefined;
}): void {
  if (!isQaDiagEnabled()) return;
  window.__dc2dDiag = {
    getStats: (): ClientDiagStats => {
      const diag = opts.scene.getDiagnosticState();
      return {
        rendererReady: diag.canvasWidth > 0 && diag.canvasHeight > 0 && !diag.webglContextLost,
        canvasWidth: diag.canvasWidth,
        canvasHeight: diag.canvasHeight,
        chunkCount: diag.chunkCount,
        playerPos: opts.getPlayerPos(),
        shaderErrors: diag.shaderErrors,
        webglContextLost: diag.webglContextLost,
        activeTextureCount: diag.activeTextureCount,
        estimatedTextureBytes: diag.estimatedTextureBytes,
        activeAudioNodes: opts.audio ? opts.audio.getActiveVoiceCount() : 0,
        fpsSampleCount: opts.onFrameTick ? opts.onFrameTick() : 0,
      };
    },
  };
}
