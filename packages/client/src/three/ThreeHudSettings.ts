/** Owns the gear menu, edit-mode switch, view distance, and window catalog. */
import type { HudWindowManager } from "./HudWindows.js";
import { ThreeHudCatalog } from "./ThreeHudCatalog.js";
import type { ViewDistance } from "./viewDistance.js";
import { createViewDistanceButton } from "./viewDistanceButton.js";

const createGear = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "⚙";
  button.setAttribute("aria-label", "HUD settings");
  button.style.cssText =
    "position:absolute;right:12px;top:12px;z-index:1300;width:34px;height:34px;" +
    "border:1px solid #71758b;background:rgba(18,19,30,.76);color:#f3f0e9;" +
    "font:20px sans-serif;pointer-events:auto";
  return button;
};

export class ThreeHudSettings {
  private readonly gear = createGear();
  private readonly menu = document.createElement("div");
  private readonly edit = document.createElement("button");
  private readonly catalog: ThreeHudCatalog;
  private visible = false;
  private editing = false;

  constructor(
    root: HTMLElement,
    private readonly manager: HudWindowManager,
    getViewDistance: () => ViewDistance,
    setViewDistance: (viewDistance: ViewDistance) => void,
  ) {
    this.catalog = new ThreeHudCatalog(manager);
    this.configureMenu(getViewDistance, setViewDistance);
    this.gear.addEventListener("click", () => this.toggleMenu());
    root.append(this.gear, this.menu);
  }

  private configureMenu(
    getViewDistance: () => ViewDistance,
    setViewDistance: (viewDistance: ViewDistance) => void,
  ): void {
    this.menu.hidden = true;
    this.menu.style.cssText =
      "position:absolute;right:12px;top:52px;z-index:1301;width:210px;" +
      "padding:10px;background:rgba(18,19,30,.96);border:1px solid #686d86;" +
      "box-shadow:0 8px 22px rgba(0,0,0,.48);pointer-events:auto";
    this.edit.type = "button";
    this.edit.style.cssText =
      "width:100%;padding:7px;border:1px solid #757a93;background:#292b40;" +
      "color:#f2f0eb;font:12px monospace";
    this.edit.addEventListener("click", () => this.toggleEditing());
    this.updateLabel();
    this.catalog.setEditing(false);
    this.menu.append(
      this.edit,
      createViewDistanceButton(getViewDistance, setViewDistance),
      this.catalog.element,
    );
  }

  private toggleMenu(): void {
    this.visible = !this.visible;
    this.menu.hidden = !this.visible;
  }

  private toggleEditing(): void {
    this.editing = !this.editing;
    this.manager.setEditing(this.editing);
    this.catalog.setEditing(this.editing);
    this.updateLabel();
  }

  private updateLabel(): void {
    this.edit.textContent = `HUD Edit Mode: ${this.editing ? "ON" : "OFF"}`;
  }
}
