/** Mirrors the 2D touch-control state in DOM while Phaser retains its input hit regions. */
import type { TouchVisualSnapshot } from "../input/touch/index.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

const circleStyle =
  "position:absolute;border:1px solid rgba(138,143,169,.85);" +
  "border-radius:50%;background:rgba(28,29,45,.45);box-sizing:border-box";

const createButton = (
  label: string,
  right: number,
  bottom: number,
  size: number,
): HTMLDivElement => {
  const button = document.createElement("div");
  button.textContent = label;
  button.style.cssText =
    `${circleStyle};right:${right}px;bottom:${bottom}px;width:${size}px;` +
    `height:${size}px;display:grid;place-items:center;font:9px monospace`;
  return button;
};

export class ThreeHudTouchOverlay {
  readonly element = document.createElement("div");
  private readonly stick = document.createElement("div");
  private readonly knob = document.createElement("div");
  private readonly attack = createButton("ATTACK", 24, 80, 40);
  private readonly jump = createButton("JUMP", 29, 130, 30);
  private readonly interact = createButton("USE", 68, 130, 30);
  private readonly bag = document.createElement("button");

  constructor(toggleInventory: () => void) {
    this.element.hidden = true;
    this.element.style.cssText =
      "position:absolute;inset:0;z-index:1050;pointer-events:none;touch-action:none";
    this.stick.style.cssText =
      `${circleStyle};width:96px;height:96px;left:20px;bottom:20px`;
    this.knob.style.cssText =
      `${circleStyle};width:34px;height:34px;left:30px;top:30px;` +
      "background:rgba(220,220,230,.22)";
    this.bag.type = "button";
    this.bag.textContent = "BAG";
    this.bag.style.cssText =
      "position:absolute;left:50%;bottom:64px;translate:-50% 0;padding:7px 12px;" +
      "border:1px solid #555a75;background:rgba(27,28,44,.82);" +
      "color:#f2f0eb;font:10px monospace;pointer-events:auto";
    this.bag.addEventListener("click", toggleInventory);
    this.stick.append(this.knob);
    this.element.append(
      this.stick,
      this.attack,
      this.jump,
      this.interact,
      this.bag,
    );
  }

  update(touch: TouchVisualSnapshot | null): void {
    this.element.hidden = touch === null;
    if (!touch) return;
    this.updateStick(touch);
    this.setPressed(this.attack, touch.buttons.attack);
    this.setPressed(this.jump, touch.buttons.jump);
    this.setPressed(this.interact, touch.buttons.interact);
  }

  private updateStick(touch: TouchVisualSnapshot): void {
    const stick = touch.stick;
    if (!stick) {
      this.stick.style.left = "20px";
      this.stick.style.top = "auto";
      this.stick.style.bottom = "20px";
      this.knob.style.transform = "";
      return;
    }
    this.stick.style.left = `${stick.x - 48}px`;
    this.stick.style.top = `${stick.y - 48}px`;
    this.stick.style.bottom = "auto";
    const magnitude = Math.max(48, Math.hypot(stick.dx, stick.dy));
    this.knob.style.transform =
      `translate(${(stick.dx * 48) / magnitude}px, ${(stick.dy * 48) / magnitude}px)`;
  }

  private setPressed(element: HTMLElement, pressed: boolean): void {
    element.style.borderColor = pressed ? HUD_GOLD : "rgba(138,143,169,.85)";
    element.style.background = pressed
      ? "rgba(255,213,76,.42)"
      : "rgba(28,29,45,.45)";
  }
}
