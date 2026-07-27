/** Renders the settings menu's scrollable HUD window visibility catalog. */
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export class HudCatalog {
  readonly element = createHudTemplate<HTMLDivElement>("hud-catalog-template");
  private readonly release: () => void;

  constructor(private readonly manager: HudWindowManager) {
    this.release = manager.onChange(() => this.render());
    this.render();
  }

  setEditing(editing: boolean): void {
    this.element.style.display = editing ? "grid" : "none";
  }

  dispose(): void {
    this.release();
  }

  private render(): void {
    const rows = this.manager.windows().map((window) => {
      const label = createHudTemplate<HTMLLabelElement>("hud-catalog-row-template");
      const input = requireHudElement<HTMLInputElement>(label, "[data-hud-catalog-toggle]");
      const copy = requireHudElement<HTMLSpanElement>(label, "[data-hud-catalog-label]");
      input.type = "checkbox";
      input.checked = window.visible;
      copy.textContent = window.title;
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        const visible = (event.currentTarget as HTMLInputElement).checked;
        this.manager.setVisible(window.id, visible);
      });
      return label;
    });
    this.element.replaceChildren(...rows);
  }
}
