import type Phaser from "phaser";
import type { TouchVisualSnapshot } from "../../../../input/touch/index.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { InventoryToggleButtonWidget } from "../inventory/inventoryToggleButton.js";
import { TouchButtonsWidget } from "./touchButtons.js";
import { TouchStickWidget } from "./touchStick.js";
import { TouchSprintWidget } from "./touchSprint.js";

export class TouchHudControls {
  private stick: TouchStickWidget | undefined;
  private sprint: TouchSprintWidget | undefined;
  private buttons: TouchButtonsWidget | undefined;
  private bag: InventoryToggleButtonWidget | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: WidgetRegistry,
  ) {}

  mount(viewport: Viewport): void {
    if (this.stick) return;
    this.stick = new TouchStickWidget(this.scene, this.registry, viewport);
    this.sprint = new TouchSprintWidget(this.scene, this.registry, viewport);
    this.buttons = new TouchButtonsWidget(this.scene, this.registry, viewport);
    this.bag = new InventoryToggleButtonWidget(
      this.scene,
      this.registry,
      viewport,
    );
  }

  unmount(): void {
    this.stick?.dispose(this.registry);
    this.sprint?.dispose(this.registry);
    this.buttons?.dispose(this.registry);
    this.bag?.dispose(this.registry);
    this.stick = undefined;
    this.sprint = undefined;
    this.buttons = undefined;
    this.bag = undefined;
  }

  update(touch: TouchVisualSnapshot | null, nowMs: number): void {
    if (!touch) return;
    this.stick?.update(touch.stick);
    this.sprint?.update(touch.buttons.sprint ?? false);
    this.buttons?.update(touch.buttons, nowMs);
  }

  resize(viewport: Viewport): void {
    this.stick?.resize(this.registry, viewport);
    this.sprint?.resize(this.registry, viewport);
    this.buttons?.resize(this.registry, viewport);
    this.bag?.resize(this.registry, viewport);
  }

  hitTest(screenX: number, screenY: number): string | null {
    const button = this.buttons?.hitTest(screenX, screenY);
    if (button) return `touch:${button}`;
    if (this.sprint?.hitTest(screenX, screenY)) return "touch:sprint";
    if (this.bag?.hitTest(screenX, screenY)) return "inventory:toggle";
    return null;
  }
}
