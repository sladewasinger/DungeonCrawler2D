/** Renders active buff/debuff chips from authoritative status ids. */
import type { Connection } from "../../../net/connection/connection.js";
import { shouldShowAutoHealing, statusViews } from "../model/HudModel.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export const DUNGEON_AUTO_HEALING_LABEL = "Dungeon Auto Healing";

export class HudBuffs {
  readonly element: HTMLElement;
  private readonly list: HTMLElement;
  private signature = "\0";

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-buffs-template");
    this.list = requireHudElement(this.element, "[data-hud-buffs-list]");
  }

  update(connection: Connection): void {
    const showAutoHealing = autoHealingVisible(connection);
    const statusSignature = statusSignatureFor(connection);
    const signature = `${showAutoHealing}:${statusSignature}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.element.hidden = false;
    const passive = showAutoHealing ? autoHealingChip() : null;
    const chips = statusViews(connection.statusEffects, connection.fx).map(statusChip);
    this.list.replaceChildren(...(passive ? [passive] : []), ...chips);
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
  const chip = createHudTemplate<HTMLSpanElement>("hud-buff-template");
  chip.textContent = DUNGEON_AUTO_HEALING_LABEL;
  return chip;
};

const statusChip = (status: ReturnType<typeof statusViews>[number]): HTMLSpanElement => {
  const chip = createHudTemplate<HTMLSpanElement>("hud-buff-template");
  chip.textContent = `${status.id.replaceAll("-", " ")} ${Math.ceil(status.remainingSeconds)}s`;
  chip.dataset.kind = status.kind === "buff" ? "buff" : "debuff";
  return chip;
};
