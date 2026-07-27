/** Builds the HUD-and-view controls embedded in the shared game menu. */
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import { HudCatalog } from "../core/HudCatalog.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";
import { createViewDistanceButton } from "../../../three/terrain/view/viewDistanceButton.js";
import { canEnterFullscreen, enterFullscreenLandscape } from "../../../ui/fullscreen/mobileFullscreen.js";
import { createHudButton } from "../styles/HudStyles.js";
import { createHudTemplate } from "../styles/hudTemplate.js";

export class HudSettings {
  readonly element = createHudTemplate<HTMLDivElement>("hud-settings-template");
  private readonly edit: HTMLButtonElement;
  private readonly catalog: HudCatalog;
  private readonly editingListeners = new Set<(editing: boolean) => void>();
  private editing = false;

  constructor(
    private readonly manager: HudWindowManager,
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
  ) {
    this.edit = this.createSettingsButton("", () => this.toggleEditing());
    this.catalog = new HudCatalog(manager);
    this.configureMenu(getViewDistance, setViewDistance);
  }

  private configureMenu(
    getViewDistance?: () => ViewDistance,
    setViewDistance?: (viewDistance: ViewDistance) => void,
  ): void {
    this.updateLabel();
    this.catalog.setEditing(false);
    const controls: HTMLElement[] = [this.edit];
    if (getViewDistance && setViewDistance) {
      controls.push(createViewDistanceButton(getViewDistance, setViewDistance));
    }
    if (canEnterFullscreen()) controls.push(this.fullscreenButton());
    controls.push(this.catalog.element);
    this.element.append(...controls);
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
    button.classList.add("hud-settings__button");
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
