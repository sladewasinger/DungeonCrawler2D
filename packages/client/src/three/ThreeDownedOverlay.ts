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
  private readonly copy = document.createElement("div");
  private readonly headline = document.createElement("div");
  private readonly fill = document.createElement("div");
  private readonly giveUpButton = document.createElement("button");
  private giveUpVisible = false;

  constructor(parent: HTMLElement, onGiveUp: () => void = () => {}) {
    this.element.style.cssText =
      "position:absolute;inset:0;display:none;place-items:center;text-align:center;" +
      "font:700 18px monospace;color:#f2e9e2;background:rgba(18,4,8,.38);pointer-events:none";
    this.headline.style.cssText =
      `font-size:clamp(32px,12vmin,68px);line-height:1;color:${DEATH_HEADLINE_COLOR};font-weight:900;` +
      `-webkit-text-stroke:2px ${DEATH_HEADLINE_OUTLINE};text-shadow:0 4px 8px #000`;
    this.copy.style.cssText =
      "white-space:pre-line;font-size:clamp(13px,3.6vmin,20px);line-height:1.45;margin-top:10px";
    const content = document.createElement("div");
    const track = document.createElement("div");
    track.style.cssText =
      `width:${HOLD_BAR_WIDTH}px;height:10px;margin:14px auto 0;border:2px solid #77778d;` +
      "background:#242436;box-sizing:border-box";
    this.fill.style.cssText =
      "height:100%;width:0;background:#ffd23d;transition:width 50ms linear";
    this.giveUpButton.type = "button";
    this.giveUpButton.textContent = "Give Up";
    this.giveUpButton.style.cssText =
      "display:block;margin:14px auto 0;min-width:160px;height:38px;padding:0 18px;" +
      "border:2px solid #ff6b7f;background:#b51631;color:#fff;font:700 16px monospace;" +
      "pointer-events:auto;cursor:pointer";
    this.giveUpButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onGiveUp();
    });
    track.append(this.fill);
    content.append(this.headline, this.copy, track, this.giveUpButton);
    this.element.append(content);
    this.element.hidden = true;
    parent.append(this.element);
  }

  update(connection: Connection, holdProgress = 0): void {
    const visible = connection.downed || connection.dead;
    this.element.hidden = !visible;
    this.element.style.display = visible ? "grid" : "none";
    const text = connection.downed
      ? downedOverlayText(connection.downedSecondsRemaining, connection.reviverName)
      : deathOverlayText(connection.respawnSecondsRemaining);
    const [headline, ...detail] = text.split("\n");
    this.headline.textContent = headline ?? "";
    this.copy.textContent = detail.join("\n");
    const progress = connection.downed
      ? Math.max(connection.reviveProgress, holdProgress)
      : 0;
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
