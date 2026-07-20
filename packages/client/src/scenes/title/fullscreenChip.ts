// Touch-only "FULLSCREEN" DOM chip for the title screen — user's own words: "we need to
// somehow be full screen in chrome on mobile? The address bar takes up a huge chunk of
// the screen." Hidden on desktop (no touch input), hidden once already fullscreen, and
// hidden outright when the Fullscreen API isn't supported at all. Also exports the same
// best-effort request TitleScene fires from the "Enter the Dungeon" tap gesture, so both
// entry points share one implementation without a second lane's file (connectForm.ts)
// needing to know about fullscreen at all.
import { isTouchDevice } from "../../input/touchDetect.js";

const GOLD = "#ffd23d";
const PANEL_BG = "#1a1a24";

interface OrientationLock {
  lock?(orientation: string): Promise<void>;
}

function isFullscreenSupported(): boolean {
  return document.fullscreenEnabled === true;
}

function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Safe to call from any user-gesture handler — swallows rejections (unsupported browser, user dismissed the prompt, already fullscreen) so callers never need their own try/catch. */
export function requestFullscreenBestEffort(): void {
  if (!isFullscreenSupported() || isFullscreen()) return;
  document.documentElement.requestFullscreen().catch(() => undefined);
  // screen.orientation.lock is absent on iOS Safari and desktop browsers — feature-detected, not awaited.
  (screen.orientation as unknown as OrientationLock).lock?.("landscape").catch(() => undefined);
}

function applyChipStyle(el: HTMLButtonElement): void {
  Object.assign(el.style, {
    position: "fixed",
    top: "max(10px, env(safe-area-inset-top))",
    right: "max(10px, env(safe-area-inset-right))",
    padding: "6px 12px",
    background: PANEL_BG,
    color: GOLD,
    border: `1px solid ${GOLD}`,
    fontFamily: "monogram, monospace",
    fontSize: "12px",
    letterSpacing: "1px",
    cursor: "pointer",
    zIndex: "21",
  });
}

export class FullscreenChip {
  private readonly button: HTMLButtonElement | undefined;
  private readonly onFullscreenChange = () => this.syncVisibility();

  constructor() {
    if (!isTouchDevice() || !isFullscreenSupported()) return;
    this.button = document.createElement("button");
    this.button.textContent = "FULLSCREEN";
    applyChipStyle(this.button);
    this.button.addEventListener("click", () => requestFullscreenBestEffort());
    document.body.append(this.button);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    this.syncVisibility();
  }

  private syncVisibility(): void {
    if (!this.button) return;
    this.button.style.display = isFullscreen() ? "none" : "block";
  }

  dispose(): void {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    this.button?.remove();
  }
}
