/** Renders the currently equipped weapon as a compact live HUD chip. */
import type { Connection } from "../../../net/connection/connection.js";
import { itemName } from "../../../ui/presentation/itemCatalog.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudWeapon {
  readonly element: HTMLElement;
  private readonly name: HTMLElement;
  private current: string | null | undefined;

  constructor() {
    this.element = createHudTemplate<HTMLElement>("hud-weapon-template");
    this.name = requireHudElement(this.element, "[data-hud-weapon-name]");
  }

  update(connection: Connection): void {
    if (connection.weapon === this.current) return;
    this.current = connection.weapon;
    this.name.textContent = connection.weapon
      ? itemName(connection.weapon)
      : "Fists";
  }
}
