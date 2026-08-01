import type Phaser from "phaser";
import type { TouchVisualSnapshot } from "../../../../input/touch/index.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { InventoryToggleButtonWidget } from "../inventory/inventoryToggleButton.js";
import { TOUCH_BUTTON_IDS, TouchActionButtonWidget, type MobileInteractionPrompt, type TouchButtonId } from "./touchButtons.js";
import { TouchStickWidget } from "./touchStick.js";
import { TouchSprintWidget } from "./touchSprint.js";

export class TouchHudControls {
  private stick: TouchStickWidget | undefined;
  private sprint: TouchSprintWidget | undefined;
  private readonly buttons = new Map<TouchButtonId, TouchActionButtonWidget>();
  private bag: InventoryToggleButtonWidget | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: WidgetRegistry,
  ) {}

  mount(viewport: Viewport): void {
    if (this.stick) return;
    this.stick = new TouchStickWidget(this.scene, this.registry, viewport);
    this.sprint = new TouchSprintWidget(this.scene, this.registry, viewport);
    for (const id of TOUCH_BUTTON_IDS) this.buttons.set(id, new TouchActionButtonWidget({ scene: this.scene, id, registry: this.registry, viewport }));
    this.bag = new InventoryToggleButtonWidget(
      this.scene,
      this.registry,
      viewport,
    );
  }

  unmount(): void {
    this.stick?.dispose(this.registry);
    this.sprint?.dispose(this.registry);
    for (const button of this.buttons.values()) button.dispose(this.registry);
    this.buttons.clear();
    this.bag?.dispose(this.registry);
    this.stick = undefined;
    this.sprint = undefined;
    this.bag = undefined;
  }

  update(input: TouchControlsUpdate): void {
    const { touch, nowMs, interactionPrompt, throwAvailable = false } = input;
    if (!touch) return;
    this.stick?.update(touch.stick);
    this.sprint?.update(touch.buttons.sprint ?? false);
    for (const button of this.buttons.values()) button.update({ pressed: touch.buttons, nowMs, interactionPrompt, throwAvailable });
  }

  resize(viewport: Viewport): void {
    this.stick?.resize(this.registry, viewport);
    this.sprint?.resize(this.registry, viewport);
    for (const button of this.buttons.values()) button.resize(this.registry, viewport);
    this.bag?.resize(this.registry, viewport);
  }

  hitTest(screenX: number, screenY: number): string | null {
    for (const [id, button] of this.buttons) {
      if (button.hitTest(screenX, screenY)) return `touch:${id.slice("touch-".length)}`;
    }
    if (this.sprint?.hitTest(screenX, screenY)) return "touch:sprint";
    if (this.bag?.hitTest(screenX, screenY)) return "inventory:toggle";
    return null;
  }
}

interface TouchControlsUpdate { touch: TouchVisualSnapshot | null; nowMs: number; interactionPrompt: MobileInteractionPrompt | null; throwAvailable?: boolean; }
