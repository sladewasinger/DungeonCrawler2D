/** Builds the HUD-and-view controls embedded in the shared game menu. */
import type { HudWindowManager } from "../window/layout/HudWindows.js";
import { HudCatalog } from "../core/HudCatalog.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";
import { createViewDistanceButton } from "../../../three/terrain/view/viewDistanceButton.js";
import { canEnterFullscreen, enterFullscreenLandscape } from "../../../ui/fullscreen/mobileFullscreen.js";
import { createHudButton } from "../styles/HudStyles.js";
import { createHudTemplate } from "../styles/hudTemplate.js";
import type { Connection } from "../../../net/connection/connection.js";
import { createExperimentalCorpNetControls } from "../../sessionMenu/network/corpNetControls.js";

interface HudSettingsOptions {
  readonly manager: HudWindowManager;
  readonly getViewDistance?: (() => ViewDistance) | undefined;
  readonly setViewDistance?: ((viewDistance: ViewDistance) => void) | undefined;
  readonly connection?: Connection | undefined;
}

export class HudSettings {
  readonly element = createHudTemplate<HTMLDivElement>("hud-settings-template");
  private readonly edit: HTMLButtonElement;
  private readonly catalog: HudCatalog;
  private readonly editingListeners = new Set<(editing: boolean) => void>();
  private editing = false;

  constructor(private readonly options: HudSettingsOptions) {
    this.edit = this.createSettingsButton("", () => this.toggleEditing());
    this.catalog = new HudCatalog(options.manager);
    this.configureMenu();
  }

  private configureMenu(): void {
    this.updateLabel();
    this.catalog.setEditing(false);
    const controls: HTMLElement[] = [this.edit];
    if (this.options.getViewDistance && this.options.setViewDistance) {
      controls.push(createViewDistanceButton(
        this.options.getViewDistance,
        this.options.setViewDistance,
      ));
    }
    if (canEnterFullscreen()) controls.push(this.fullscreenButton());
    if (this.options.connection) {
      controls.push(...createExperimentalCorpNetControls(this.options.connection));
    }
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
    this.options.manager.setEditing(this.editing);
    this.catalog.setEditing(this.editing);
    this.updateLabel();
    for (const listener of this.editingListeners) listener(this.editing);
  }

  private updateLabel(): void {
    this.edit.textContent = `HUD Edit Mode: ${this.editing ? "ON" : "OFF"}`;
  }
}
