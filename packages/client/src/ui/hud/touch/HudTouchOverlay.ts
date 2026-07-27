/** Mirrors the 2D touch-control state in DOM while Phaser retains its input hit regions. */
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import {
  HTML_TOUCH_ACTIONS,
  HTML_TOUCH_BAG,
  HTML_TOUCH_STICK,
  type HtmlTouchAction,
  type HtmlTouchActionRegion,
} from "./HtmlTouchLayout.js";
import { HUD_GOLD } from "../../../ui/hud/styles/HudStyles.js";

const circleStyle =
  "position:absolute;border:1px solid rgba(138,143,169,.85);" +
  "border-radius:50%;background:rgba(28,29,45,.45);box-sizing:border-box";

const createButton = (
  region: HtmlTouchActionRegion,
): HTMLDivElement => {
  const button = document.createElement("div");
  button.textContent = region.label;
  button.style.cssText =
    `${circleStyle};right:${region.right}px;bottom:${region.bottom}px;` +
    `width:${region.size}px;height:${region.size}px;display:grid;` +
    "place-items:center;font:9px monospace";
  return button;
};

export class HudTouchOverlay {
  readonly element = document.createElement("div");
  private readonly stick = document.createElement("div");
  private readonly knob = document.createElement("div");
  private readonly buttons = new Map<HtmlTouchAction, HTMLDivElement>(
    HTML_TOUCH_ACTIONS.map((region) => [region.action, createButton(region)]),
  );
  private readonly bag = document.createElement("button");

  constructor(toggleInventory: () => void) {
    this.element.hidden = true;
    this.element.style.cssText =
      "position:absolute;inset:0;z-index:1050;pointer-events:none;touch-action:none";
    configureTouchStick(this.stick, this.knob);
    configureTouchBag(this.bag, toggleInventory);
    this.stick.append(this.knob);
    this.element.append(this.stick, ...this.buttons.values(), this.bag);
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
    element.style.borderColor = pressed ? HUD_GOLD : "rgba(138,143,169,.85)";
    element.style.background = pressed
      ? "rgba(255,213,76,.42)"
      : "rgba(28,29,45,.45)";
  }
}

const configureTouchStick = (stick: HTMLDivElement, knob: HTMLDivElement): void => {
  stick.style.cssText =
    `${circleStyle};width:${HTML_TOUCH_STICK.width}px;` +
    `height:${HTML_TOUCH_STICK.height}px;left:${HTML_TOUCH_STICK.left}px;` +
    `bottom:${HTML_TOUCH_STICK.bottom}px`;
  knob.style.cssText =
      `${circleStyle};width:34px;height:34px;left:30px;top:30px;` +
      "background:rgba(220,220,230,.22)";
};

const configureTouchBag = (bag: HTMLButtonElement, toggleInventory: () => void): void => {
  bag.type = "button";
  bag.textContent = "BAG";
  bag.style.cssText =
      `position:absolute;left:50%;bottom:${HTML_TOUCH_BAG.bottom}px;` +
      `width:${HTML_TOUCH_BAG.width}px;height:${HTML_TOUCH_BAG.height}px;` +
      "translate:-50% 0;" +
      "border:1px solid #555a75;background:rgba(27,28,44,.82);" +
      "color:#f2f0eb;font:10px monospace;pointer-events:auto";
  bag.addEventListener("click", toggleInventory);
};

const resetTouchStick = (stick: HTMLDivElement, knob: HTMLDivElement): void => {
  stick.style.left = "20px";
  stick.style.top = "auto";
  stick.style.bottom = "20px";
  knob.style.transform = "";
};
