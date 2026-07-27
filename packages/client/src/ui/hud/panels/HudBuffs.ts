/** Renders active buff/debuff chips from authoritative status ids. */
import type { Connection } from "../../../net/connection/connection.js";
import { shouldShowAutoHealing, statusViews } from "../model/HudModel.js";
import { HUD_PANEL } from "../styles/HudStyles.js";

export class HudBuffs {
  readonly element = document.createElement("div");
  private signature = "\0";

  constructor() {
    this.element.style.cssText =
      `${HUD_PANEL};display:flex;gap:5px;align-items:center;flex-wrap:wrap`;
  }

  update(connection: Connection): void {
    const showAutoHealing = autoHealingVisible(connection);
    const statusSignature = statusSignatureFor(connection);
    const signature = `${showAutoHealing}:${statusSignature}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.element.style.visibility = "visible";
    const passive = showAutoHealing ? autoHealingChip() : null;
    const chips = statusViews(connection.statusEffects, connection.fx).map(statusChip);
    this.element.replaceChildren(...(passive ? [passive] : []), ...chips);
  }
}

const autoHealingVisible = (connection: Connection): boolean => shouldShowAutoHealing({
  hp: connection.hp,
  maxHp: connection.maxHp,
  regenerationDelaySeconds: connection.healthRegenerationDelaySeconds,
  actionable: connection.canAct,
});

const statusSignatureFor = (connection: Connection): string => connection.statusEffects.length > 0
  ? connection.statusEffects.map((status) => `${status.id}:${status.remainingSeconds}`).join("|")
  : connection.fx.join("|");

const autoHealingChip = (): HTMLSpanElement => {
  const chip = document.createElement("span");
  chip.textContent = "basic auto healing";
  chip.className = "hud-buff hud-buff--positive";
  return chip;
};

const statusChip = (status: ReturnType<typeof statusViews>[number]): HTMLSpanElement => {
  const chip = document.createElement("span");
  chip.textContent = `${status.id.replaceAll("-", " ")} ${Math.ceil(status.remainingSeconds)}s`;
  chip.style.cssText = `padding:4px 6px;border:1px solid ${status.kind === "buff" ? "#4f9a72" : "#a44c59"};background:${status.kind === "buff" ? "rgba(42,92,67,.78)" : "rgba(103,39,51,.78)"};font-size:10px;text-transform:uppercase`;
  return chip;
};
