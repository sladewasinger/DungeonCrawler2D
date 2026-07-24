/** Builds the HUD-and-view controls embedded in the shared game menu. */
import type { HudWindowManager } from "./HudWindows.js";
import { ThreeHudCatalog } from "./ThreeHudCatalog.js";
import type { ViewDistance } from "./viewDistance.js";
import { createViewDistanceButton } from "./viewDistanceButton.js";
import { canEnterFullscreen, enterFullscreenLandscape } from "../ui/fullscreen/mobileFullscreen.js";
import { createHudButton } from "./ThreeHudStyles.js";

export class ThreeHudSettings {
  readonly element = document.createElement("div");
  private readonly edit: HTMLButtonElement;
  private readonly catalog: ThreeHudCatalog;
  private readonly editingListeners = new Set<(editing: boolean) => void>();
  private editing = false;

  constructor(
    private readonly manager: HudWindowManager,
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
    replayTutorials?: () => void,
  ) {
    this.edit = this.createSettingsButton("", () => this.toggleEditing());
    this.catalog = new ThreeHudCatalog(manager);
    this.configureMenu(getViewDistance, setViewDistance, replayTutorials);
  }

  private configureMenu(
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
    replayTutorials?: () => void,
  ): void {
    this.element.style.cssText = "display:grid;gap:6px";
    this.updateLabel();
    this.catalog.setEditing(false);
    const controls: HTMLElement[] = [this.edit];
    if (getViewDistance && setViewDistance) {
      controls.push(createViewDistanceButton(getViewDistance, setViewDistance));
    }
    if (replayTutorials) {
      controls.push(this.replayButton(replayTutorials));
    }
    if (canEnterFullscreen()) controls.push(this.fullscreenButton());
    controls.push(this.catalog.element);
    this.element.append(...controls);
  }

  private replayButton(replay: () => void): HTMLButtonElement {
    const button = this.createSettingsButton("Replay tutorial hints", replay);
    button.style.marginTop = "6px";
    return button;
  }

  private fullscreenButton(): HTMLButtonElement {
    return this.createSettingsButton("Enter Full Screen", () => {
      void enterFullscreenLandscape();
    });
  }

  private createSettingsButton(
    label: string,
    action: () => void,
  ): HTMLButtonElement {
    const button = createHudButton(label, action);
    Object.assign(button.style, {
      width: "100%",
      padding: "7px",
      borderColor: "#757a93",
      background: "#292b40",
      fontSize: "12px",
    });
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
