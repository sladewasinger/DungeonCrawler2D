/** Renders the settings menu's scrollable HUD window visibility catalog. */
import type { HudWindowManager } from "./HudWindows.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

export class ThreeHudCatalog {
  readonly element = document.createElement("div");
  private readonly release: () => void;

  constructor(private readonly manager: HudWindowManager) {
    this.element.style.cssText =
      "max-height:220px;margin-top:8px;padding-top:8px;border-top:1px solid #454960;" +
      "overflow-y:auto;display:grid;gap:5px;scrollbar-color:#555a75 #171827";
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
      const label = document.createElement("label");
      label.style.cssText =
        "display:flex;align-items:center;gap:7px;padding:3px;color:#e6e5ef";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = window.visible;
      input.style.accentColor = HUD_GOLD;
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        const visible = (event.currentTarget as HTMLInputElement).checked;
        this.manager.setVisible(window.id, visible);
      });
      label.append(input, document.createTextNode(window.title));
      return label;
    });
    this.element.replaceChildren(...rows);
  }
}
