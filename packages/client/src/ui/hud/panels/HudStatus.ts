/** Renders live health, level, and XP using the established 2D HUD palette. */
import type { Connection } from "../../../net/connection/connection.js";
import { xpProgressRatio } from "../../../ui/widgets/hud/bars/xpBarView.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudStatus {
  readonly element: HTMLElement;
  private readonly title: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthLabel: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly staminaLabel: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpLabel: HTMLElement;

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-status-template");
    this.title = requireHudElement(this.element, "[data-hud-status-title]");
    this.healthFill = requireHudElement(this.element, "[data-hud-health-fill]");
    this.healthLabel = requireHudElement(this.element, "[data-hud-health-label]");
    this.staminaFill = requireHudElement(this.element, "[data-hud-stamina-fill]");
    this.staminaLabel = requireHudElement(this.element, "[data-hud-stamina-label]");
    this.xpFill = requireHudElement(this.element, "[data-hud-xp-fill]");
    this.xpLabel = requireHudElement(this.element, "[data-hud-xp-label]");
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
    this.staminaLabel.dataset.exhausted = String(connection.staminaExhausted);
    this.xpLabel.textContent =
      `Lv ${connection.charLevel} · ${connection.xpForNext} XP to next`;
    this.title.textContent = connection.hp <= 0
      ? "Respawning"
      : `Crawler · Floor ${floor}`;
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
