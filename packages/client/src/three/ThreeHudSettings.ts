/** Builds the HUD-and-view controls embedded in the shared game menu. */
import type { HudWindowManager } from "./HudWindows.js";
import { ThreeHudCatalog } from "./ThreeHudCatalog.js";
import type { ViewDistance } from "./viewDistance.js";
import { createViewDistanceButton } from "./viewDistanceButton.js";

export class ThreeHudSettings {
  readonly element = document.createElement("div");
  private readonly edit = document.createElement("button");
  private readonly catalog: ThreeHudCatalog;
  private readonly editingListeners = new Set<(editing: boolean) => void>();
  private editing = false;

  constructor(
    private readonly manager: HudWindowManager,
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
    replayTutorials?: () => void,
  ) {
    this.catalog = new ThreeHudCatalog(manager);
    this.configureMenu(getViewDistance, setViewDistance, replayTutorials);
  }

  private configureMenu(
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
    replayTutorials?: () => void,
  ): void {
    this.element.style.cssText = "display:grid;gap:6px";
    this.edit.type = "button";
    this.edit.style.cssText =
      "width:100%;padding:7px;border:1px solid #757a93;background:#292b40;" +
      "color:#f2f0eb;font:12px monospace";
    this.edit.addEventListener("click", () => this.toggleEditing());
    this.updateLabel();
    this.catalog.setEditing(false);
    const controls: HTMLElement[] = [this.edit];
    if (getViewDistance && setViewDistance) {
      controls.push(createViewDistanceButton(getViewDistance, setViewDistance));
    }
    if (replayTutorials) {
      controls.push(this.replayButton(replayTutorials));
    }
    controls.push(this.catalog.element);
    this.element.append(...controls);
  }

  private replayButton(replay: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Replay tutorial hints";
    button.style.cssText =
      "width:100%;margin-top:6px;padding:7px;border:1px solid #757a93;" +
      "background:#292b40;color:#f2f0eb;font:12px monospace";
    button.addEventListener("click", replay);
    return button;
  }

  dispose(): void {
    this.catalog.dispose();
    this.editingListeners.clear();
    this.element.remove();
  }

  onEditingChange(listener: (editing: boolean) => void): () => void {
    this.editingListeners.add(listener);
    return () => this.editingListeners.delete(listener);
  }

  private toggleEditing(): void {
    this.editing = !this.editing;
    this.manager.setEditing(this.editing);
    this.catalog.setEditing(this.editing);
    this.updateLabel();
    for (const listener of this.editingListeners) listener(this.editing);
  }

  private updateLabel(): void {
    this.edit.textContent = `HUD Edit Mode: ${this.editing ? "ON" : "OFF"}`;
  }
}
