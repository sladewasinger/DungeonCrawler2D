/** Renders live health, level, and XP using the established 2D HUD palette. */
import type { Connection } from "../../../net/connection/connection.js";
import { xpProgressRatio } from "../../../ui/widgets/hud/bars/xpBarView.js";
import { HUD_GOLD, HUD_PANEL, createHudTitle } from "../styles/ThreeHudStyles.js";

export class ThreeHudStatus {
  readonly element = document.createElement("div");
  private readonly title = createHudTitle("Crawler");
  private readonly healthFill = document.createElement("div");
  private readonly healthLabel = document.createElement("div");
  private readonly staminaFill = document.createElement("div");
  private readonly staminaLabel = document.createElement("div");
  private readonly xpFill = document.createElement("div");
  private readonly xpLabel = document.createElement("div");

  constructor() {
    this.element.style.cssText = HUD_PANEL;
    const healthTrack = this.createTrack(18, "#db4c4d", this.healthFill);
    const staminaTrack = this.createTrack(9, "#59b5a8", this.staminaFill);
    const xpTrack = this.createTrack(7, HUD_GOLD, this.xpFill);
    this.healthLabel.style.cssText = "font-size:15px;font-weight:700;margin:4px 0 3px";
    this.staminaLabel.style.cssText =
      "color:#9ddbd2;font-size:10px;margin:2px 0 3px";
    this.xpLabel.style.cssText = "color:#d8d5df;font-size:10px";
    this.element.append(
      this.title,
      healthTrack,
      this.healthLabel,
      staminaTrack,
      this.staminaLabel,
      xpTrack,
      this.xpLabel,
    );
  }

  update(connection: Connection, floor: number): void {
    this.updateBars(connection);
    this.updateLabels(connection, floor);
  }

  private updateBars(connection: Connection): void {
    this.healthFill.style.width = percentage(connection.hp, connection.maxHp);
    this.staminaFill.style.width = percentage(connection.stamina, connection.maxStamina);
    this.xpFill.style.width = `${xpProgressRatio({
      xp: connection.xp,
      level: connection.charLevel,
      xpForNext: connection.xpForNext,
    }) * 100}%`;
  }

  private updateLabels(connection: Connection, floor: number): void {
    this.healthLabel.textContent =
      `${Math.ceil(Math.max(0, connection.hp))} / ${connection.maxHp}`;
    this.staminaLabel.textContent = staminaText(connection);
    this.staminaLabel.style.color = connection.staminaExhausted
      ? "#ffc46b"
      : "#9ddbd2";
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

const percentage = (value: number, maximum: number): string =>
  `${Math.max(0, Math.min(1, maximum > 0 ? value / maximum : 0)) * 100}%`;

const staminaText = (connection: Connection): string => {
  if (!connection.staminaExhausted && !connection.blocking) {
    return `${Math.ceil(connection.stamina)} / ${connection.maxStamina} stamina`;
  }
  if (connection.blocking) return `Blocking · ${Math.ceil(connection.stamina)} stamina`;
  return connection.staminaRecoveryDelaySeconds > 0
    ? `OUT OF BREATH · ${connection.staminaRecoveryDelaySeconds.toFixed(1)}s`
    : "OUT OF BREATH · recovering";
};
