/** Renders the currently equipped weapon as a compact live HUD chip. */
import type { Connection } from "../net/connection.js";
import { itemName } from "../ui/itemCatalog.js";
import { HUD_PANEL, createHudTitle } from "./ThreeHudStyles.js";

export class ThreeHudWeapon {
  readonly element = document.createElement("div");
  private readonly name = document.createElement("div");
  private current: string | null | undefined;

  constructor() {
    this.element.style.cssText = `${HUD_PANEL};display:grid;align-content:center`;
    this.name.style.cssText = "font-size:16px;font-weight:700;text-align:center";
    this.element.append(createHudTitle("Active weapon"), this.name);
  }

  update(connection: Connection): void {
    if (connection.weapon === this.current) return;
    this.current = connection.weapon;
    this.name.textContent = connection.weapon
      ? itemName(connection.weapon)
      : "Fists";
  }
}
