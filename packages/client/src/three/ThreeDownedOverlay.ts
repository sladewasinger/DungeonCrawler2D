/** Owns the first-person downed/death message without adding layout logic to ThreeHud. */
import type { Connection } from "../net/connection.js";
import {
  DEATH_HEADLINE_COLOR,
  DEATH_HEADLINE_OUTLINE,
  deathOverlayText,
  downedOverlayText,
  giveUpButtonVisible,
} from "../ui/widgets/hud/deathOverlay.js";

const HOLD_BAR_WIDTH = 220;

function syncGiveUpButton(
  button: HTMLButtonElement,
  visible: boolean,
  wasVisible: boolean,
): boolean {
  button.hidden = !visible;
  button.style.display = visible ? "block" : "none";
  if (visible && !wasVisible) document.exitPointerLock?.();
  return visible;
}

export class ThreeDownedOverlay {
  readonly element = document.createElement("div");
  readonly copy = document.createElement("div");
  readonly headline = document.createElement("div");
  readonly fill = document.createElement("div");
  readonly giveUpButton = document.createElement("button");
  private giveUpVisible = false;

  constructor(parent: HTMLElement, onGiveUp: () => void = () => {}) {
    configureOverlayElements(this, onGiveUp);
    mountOverlay(parent, this);
  }

  update(connection: Connection, holdProgress = 0): void {
    const visible = connection.downed || connection.dead;
    this.element.hidden = !visible;
    this.element.style.display = visible ? "grid" : "none";
    const text = overlayText(connection);
    const [headline, ...detail] = text.split("\n");
    this.headline.textContent = headline ?? "";
    this.copy.textContent = detail.join("\n");
    const progress = downedProgress(connection, holdProgress);
    const track = this.fill.parentElement;
    if (track) track.hidden = !connection.downed || progress <= 0;
    const buttonVisible = giveUpButtonVisible(
      connection.downed,
      connection.dead,
    );
    this.giveUpVisible = syncGiveUpButton(
      this.giveUpButton,
      buttonVisible,
      this.giveUpVisible,
    );
    this.fill.style.width =
      `${HOLD_BAR_WIDTH * Math.min(1, Math.max(0, progress))}px`;
  }
}

const configureOverlayElements = (overlay: ThreeDownedOverlay, onGiveUp: () => void): void => {
  overlay.element.style.cssText = "position:absolute;inset:0;display:none;place-items:center;text-align:center;font:700 18px monospace;color:#f2e9e2;background:rgba(18,4,8,.38);pointer-events:none";
  overlay.headline.style.cssText = `font-size:clamp(32px,12vmin,68px);line-height:1;color:${DEATH_HEADLINE_COLOR};font-weight:900;-webkit-text-stroke:2px ${DEATH_HEADLINE_OUTLINE};text-shadow:0 4px 8px #000`;
  overlay.copy.style.cssText = "white-space:pre-line;font-size:clamp(13px,3.6vmin,20px);line-height:1.45;margin-top:10px";
  overlay.fill.style.cssText = "height:100%;width:0;background:#ffd23d;transition:width 50ms linear";
  configureGiveUpButton(overlay.giveUpButton, onGiveUp);
};

const configureGiveUpButton = (button: HTMLButtonElement, onGiveUp: () => void): void => {
  button.type = "button";
  button.textContent = "Give Up";
  button.style.cssText = "display:block;margin:14px auto 0;min-width:160px;height:38px;padding:0 18px;border:2px solid #ff6b7f;background:#b51631;color:#fff;font:700 16px monospace;pointer-events:auto;cursor:pointer";
  button.addEventListener("click", (event) => { event.stopPropagation(); onGiveUp(); });
};

const mountOverlay = (parent: HTMLElement, overlay: ThreeDownedOverlay): void => {
  const track = document.createElement("div");
  track.style.cssText = `width:${HOLD_BAR_WIDTH}px;height:10px;margin:14px auto 0;border:2px solid #77778d;background:#242436;box-sizing:border-box`;
  const content = document.createElement("div");
  track.append(overlay.fill);
  content.append(overlay.headline, overlay.copy, track, overlay.giveUpButton);
  overlay.element.append(content);
  overlay.element.hidden = true;
  parent.append(overlay.element);
};

const overlayText = (connection: Connection): string => connection.downed
  ? downedOverlayText(connection.downedSecondsRemaining, connection.reviverName)
  : deathOverlayText(connection.respawnSecondsRemaining);

const downedProgress = (connection: Connection, holdProgress: number): number =>
  connection.downed ? Math.max(connection.reviveProgress, holdProgress) : 0;
