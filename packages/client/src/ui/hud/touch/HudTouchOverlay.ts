/** Mirrors the 2D touch-control state in DOM while Phaser retains its input hit regions. */
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import {
  HTML_TOUCH_ACTIONS,
  HTML_TOUCH_STICK,
  type HtmlTouchAction,
  type HtmlTouchActionRegion,
} from "./HtmlTouchLayout.js";
import { createHudTemplate, requireHudElement } from "../../../ui/hud/styles/hudTemplate.js";

export class HudTouchOverlay {
  readonly element = createHudTemplate<HTMLDivElement>("hud-touch-template");
  private readonly stick = requireHudElement<HTMLDivElement>(this.element, "[data-hud-touch-stick]");
  private readonly knob = requireHudElement<HTMLDivElement>(this.element, "[data-hud-touch-knob]");
  private readonly buttons = new Map<HtmlTouchAction, HTMLButtonElement>();
  private readonly bag = requireHudElement<HTMLButtonElement>(this.element, "[data-hud-touch-bag]");

  constructor(toggleInventory: () => void) {
    this.element.hidden = true;
    for (const region of HTML_TOUCH_ACTIONS) {
      const button = requireHudElement<HTMLButtonElement>(this.element, `[data-hud-touch-button="${region.action}"]`);
      positionTouchButton(button, region);
      this.buttons.set(region.action, button);
    }
    configureTouchStick(this.stick, this.knob);
    this.bag.addEventListener("click", toggleInventory);
  }

  update(touch: TouchVisualSnapshot | null): void {
    this.element.hidden = touch === null;
    if (!touch) return;
    this.updateStick(touch);
    this.setPressed("attack", touch.buttons.attack);
    this.setPressed("block", touch.buttons.block ?? false);
    this.setPressed("jump", touch.buttons.jump);
    this.setPressed("interact", touch.buttons.interact);
  }

  private updateStick(touch: TouchVisualSnapshot): void {
    const stick = touch.stick;
    if (!stick) return resetTouchStick(this.stick, this.knob);
    this.stick.style.left = `${stick.x - 48}px`;
    this.stick.style.top = `${stick.y - 48}px`;
    this.stick.style.bottom = "auto";
    const magnitude = Math.max(48, Math.hypot(stick.dx, stick.dy));
    this.knob.style.transform =
      `translate(${(stick.dx * 48) / magnitude}px, ${(stick.dy * 48) / magnitude}px)`;
  }

  private setPressed(action: HtmlTouchAction, pressed: boolean): void {
    const element = this.buttons.get(action);
    if (!element) return;
    element.dataset.pressed = String(pressed);
  }
}

const configureTouchStick = (stick: HTMLDivElement, knob: HTMLDivElement): void => {
  Object.assign(stick.style, {
    width: `${HTML_TOUCH_STICK.width}px`, height: `${HTML_TOUCH_STICK.height}px`,
    left: `${HTML_TOUCH_STICK.left}px`, bottom: `${HTML_TOUCH_STICK.bottom}px`,
  });
  knob.style.left = "30px";
  knob.style.top = "30px";
};

const positionTouchButton = (button: HTMLButtonElement, region: HtmlTouchActionRegion): void => {
  Object.assign(button.style, {
    right: `${region.right}px`, bottom: `${region.bottom}px`,
    width: `${region.size}px`, height: `${region.size}px`,
  });
};

const resetTouchStick = (stick: HTMLDivElement, knob: HTMLDivElement): void => {
  stick.style.left = "20px";
  stick.style.top = "auto";
  stick.style.bottom = "20px";
  knob.style.transform = "";
};
