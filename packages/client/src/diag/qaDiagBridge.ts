/** Gated QA diagnostic bridge exposing live renderer, chunk, player, and shader telemetry. */
import type { WorldScene } from "../render/world/worldScene.js";

export interface ClientDiagStats {
  readonly rendererReady: boolean;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly chunkCount: number;
  readonly playerPos: { readonly x: number; readonly y: number } | null;
  readonly shaderErrors: readonly string[];
  readonly fpsSampleCount: number;
}

export interface ClientDiagBridge {
  getStats(): ClientDiagStats;
}

declare global {
  interface Window {
    __dc2dDiag?: ClientDiagBridge;
  }
}

export function isQaDiagEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get("qaDiag") === "1";
}

export function installQaDiagBridge(opts: {
  readonly scene: WorldScene;
  readonly getPlayerPos: () => { readonly x: number; readonly y: number } | null;
  readonly onFrameTick?: (() => number) | undefined;
}): void {
  if (!isQaDiagEnabled()) return;
  window.__dc2dDiag = {
    getStats: (): ClientDiagStats => {
      const diag = opts.scene.getDiagnosticState();
      return {
        rendererReady: diag.canvasWidth > 0 && diag.canvasHeight > 0,
        canvasWidth: diag.canvasWidth,
        canvasHeight: diag.canvasHeight,
        chunkCount: diag.chunkCount,
        playerPos: opts.getPlayerPos(),
        shaderErrors: diag.shaderErrors,
        fpsSampleCount: opts.onFrameTick ? opts.onFrameTick() : 0,
      };
    },
  };
}
