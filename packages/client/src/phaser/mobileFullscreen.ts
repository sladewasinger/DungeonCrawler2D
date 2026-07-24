/** Adapts Phaser's game canvas to the shared mobile fullscreen lifecycle. */
import { installFullscreenResumeRetry, type FullscreenRetry } from "../ui/fullscreen/mobileFullscreen.js";

export function installPhaserFullscreenRetry(canvas: HTMLElement): FullscreenRetry {
  return installFullscreenResumeRetry(canvas);
}
