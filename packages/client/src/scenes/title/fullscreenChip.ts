import { isTouchDevice } from "../../input/touchDetect.js";
import { canEnterFullscreen, enterFullscreenLandscape, isFullscreenActive } from "../../ui/fullscreen/mobileFullscreen.js";

const GOLD = "#ffd23d";
const PANEL_BG = "#1a1a24";

export function requestFullscreenBestEffort(): void {
  void enterFullscreenLandscape();
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
    if (!isTouchDevice() || !canEnterFullscreen()) return;
    this.button = document.createElement("button");
    this.button.textContent = "FULLSCREEN";
    applyChipStyle(this.button);
    this.button.addEventListener("click", requestFullscreenBestEffort);
    document.body.append(this.button);
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.onFullscreenChange);
    this.syncVisibility();
  }

  private syncVisibility(): void {
    if (!this.button) return;
    this.button.style.display = isFullscreenActive() ? "none" : "block";
  }

  dispose(): void {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this.onFullscreenChange);
    this.button?.remove();
  }
}
