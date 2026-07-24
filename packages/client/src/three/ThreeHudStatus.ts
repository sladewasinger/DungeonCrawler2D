/** Renders live health, level, and XP using the established 2D HUD palette. */
import type { Connection } from "../net/connection.js";
import { xpProgressRatio } from "../ui/widgets/hud/xpBarView.js";
import { HUD_GOLD, HUD_PANEL, createHudTitle } from "./ThreeHudStyles.js";

export class ThreeHudStatus {
  readonly element = document.createElement("div");
  private readonly title = createHudTitle("Crawler");
  private readonly healthFill = document.createElement("div");
  private readonly healthLabel = document.createElement("div");
  private readonly xpFill = document.createElement("div");
  private readonly xpLabel = document.createElement("div");

  constructor() {
    this.element.style.cssText = HUD_PANEL;
    const healthTrack = this.createTrack(18, "#db4c4d", this.healthFill);
    const xpTrack = this.createTrack(7, HUD_GOLD, this.xpFill);
    this.healthLabel.style.cssText = "font-size:15px;font-weight:700;margin:4px 0 3px";
    this.xpLabel.style.cssText = "color:#d8d5df;font-size:10px";
    this.element.append(
      this.title,
      healthTrack,
      this.healthLabel,
      xpTrack,
      this.xpLabel,
    );
  }

  update(connection: Connection, floor: number): void {
    const healthRatio = connection.maxHp > 0
      ? connection.hp / connection.maxHp
      : 0;
    const xpRatio = xpProgressRatio({
      xp: connection.xp,
      level: connection.charLevel,
      xpForNext: connection.xpForNext,
    });
    this.healthFill.style.width = `${Math.max(0, Math.min(1, healthRatio)) * 100}%`;
    this.xpFill.style.width = `${xpRatio * 100}%`;
    this.healthLabel.textContent =
      `${Math.ceil(Math.max(0, connection.hp))} / ${connection.maxHp}`;
    this.xpLabel.textContent =
      `Lv ${connection.charLevel} · ${connection.xpForNext} XP to next`;
    this.title.textContent = connection.hp <= 0
      ? "Respawning"
      : `Crawler · Floor ${floor}`;
  }

  private createTrack(
    height: number,
    color: string,
    fill: HTMLDivElement,
  ): HTMLDivElement {
    const track = document.createElement("div");
    track.style.cssText =
      `height:${height}px;border:1px solid #666b80;background:#282535;` +
      "padding:2px;box-sizing:border-box";
    fill.style.cssText = `height:100%;width:0;background:${color}`;
    track.append(fill);
    return track;
  }
}
