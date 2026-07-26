/** Owns the first-person downed/death message without adding layout logic to ThreeHud. */
import type { Connection } from "../net/connection.js";
import { deathOverlayText } from "../ui/widgets/hud/deathOverlay.js";

const HOLD_BAR_WIDTH = 220;

export class ThreeDownedOverlay {
  readonly element = document.createElement("div");
  private readonly copy = document.createElement("div");
  private readonly fill = document.createElement("div");

  constructor(parent: HTMLElement) {
    this.element.style.cssText =
      "position:absolute;inset:0;display:none;place-items:center;text-align:center;" +
      "font:700 18px monospace;color:#f2e9e2;background:rgba(18,4,8,.38);pointer-events:none";
    this.copy.style.whiteSpace = "pre-line";
    const content = document.createElement("div");
    const track = document.createElement("div");
    track.style.cssText =
      `width:${HOLD_BAR_WIDTH}px;height:10px;margin:14px auto 0;border:2px solid #77778d;` +
      "background:#242436;box-sizing:border-box";
    this.fill.style.cssText =
      "height:100%;width:0;background:#ffd23d;transition:width 50ms linear";
    track.append(this.fill);
    content.append(this.copy, track);
    this.element.append(content);
    this.element.hidden = true;
    parent.append(this.element);
  }

  update(connection: Connection, holdProgress = 0): void {
    const visible = connection.downed || connection.dead;
    this.element.hidden = !visible;
    this.element.style.display = visible ? "grid" : "none";
    this.copy.textContent = connection.downed
      ? "DOWNED\nHold [K] to give up\nA party member can revive you"
      : deathOverlayText(connection.respawnSecondsRemaining);
    this.fill.parentElement!.hidden = !connection.dead;
    this.fill.style.width =
      `${HOLD_BAR_WIDTH * Math.min(1, Math.max(0, holdProgress))}px`;
  }
}
