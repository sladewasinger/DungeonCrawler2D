import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { createItemIcon } from "./itemIcon.js";
const WIDGET_ID = "touch-buttons";
const ATTACK_SIZE = 50;
const SECONDARY_SIZE = 40;
const GAP = 6;
const REST_ALPHA = 0.35;
const ATTACK_REST_ALPHA = 0.55;
const PRESSED_ALPHA = 1;
export const ATTACK_PULSE_DURATION_MS = 10_000;
const ATTACK_PULSE_PERIOD_MS = 1200;
const ATTACK_PULSE_AMPLITUDE = 0.15;
const BUTTON_LABELS: Record<Exclude<TouchButtonKind, "attack">, string> = { block: "BLOCK", jump: "JUMP", interact: "USE", throw: "THROW" };
export function attackRestAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= ATTACK_PULSE_DURATION_MS) return ATTACK_REST_ALPHA;
  const phase = (elapsedMs % ATTACK_PULSE_PERIOD_MS) / ATTACK_PULSE_PERIOD_MS;
  const wave = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  return ATTACK_REST_ALPHA + wave * ATTACK_PULSE_AMPLITUDE;
}
export type TouchButtonKind = "attack" | "block" | "jump" | "interact" | "throw";
interface ButtonVisual {
  kind: TouchButtonKind;
  x: number;
  y: number;
  size: number;
  cell: Phaser.GameObjects.Arc;
}
function buttonFill(button: ButtonVisual, pressed: TouchButtonsPressed, attackAlpha: number): [number, number] {
  const isPressed = button.kind !== "throw" && (pressed[button.kind] ?? false);
  const restAlpha = button.kind === "attack" ? attackAlpha : REST_ALPHA;
  return isPressed ? [SELECTION_ACCENT, PRESSED_ALPHA] : [PANEL_FILL, restAlpha];
}
export interface TouchButtonsPressed { attack: boolean; jump: boolean; interact: boolean; block?: boolean; }
export function actionButtonLayout(): Record<TouchButtonKind, { x: number; y: number; size: number }> {
  const attack = { x: -ATTACK_SIZE / 2, y: -ATTACK_SIZE / 2, size: ATTACK_SIZE };
  const jump = { x: attack.x, y: -(ATTACK_SIZE + GAP + SECONDARY_SIZE / 2), size: SECONDARY_SIZE };
  const interact = { x: jump.x - (SECONDARY_SIZE + GAP), y: jump.y, size: SECONDARY_SIZE };
  const throwItem = { x: attack.x - (ATTACK_SIZE / 2 + GAP + SECONDARY_SIZE / 2), y: attack.y, size: SECONDARY_SIZE };
  const block = {
    x: throwItem.x - (SECONDARY_SIZE + GAP),
    y: attack.y,
    size: SECONDARY_SIZE,
  };
  return { attack, block, jump, interact, throw: throwItem };
}
export class TouchButtonsWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttons: ButtonVisual[] = [];
  private readonly scale: number;
    private readonly sessionStartMs: number;
  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    this.sessionStartMs = scene.time.now;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-right",
      defaultOffset: { x: -12, y: -40 },
      defaultScale: 1,
      defaultVisible: true,
    });
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.scale = layout.scale;
    this.container = createWidgetContainer(scene, layout);
    const positions = actionButtonLayout();
    this.buildButton("attack", positions.attack);
    this.buildButton("block", positions.block);
    this.buildButton("jump", positions.jump);
    this.buildButton("interact", positions.interact);
    this.buildButton("throw", positions.throw);
  }
  private buildButton(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): void {
    const restAlpha = kind === "attack" ? attackRestAlpha(0) : REST_ALPHA;
    const cell = this.scene.add.circle(pos.x, pos.y, pos.size / 2, PANEL_FILL, restAlpha).setStrokeStyle(1, PANEL_BORDER);
    this.container.add(cell);
    this.container.add(this.buildGlyph(kind, pos));
    this.buttons.push({ kind, x: pos.x, y: pos.y, size: pos.size, cell });
  }
  private buildGlyph(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): Phaser.GameObjects.GameObject {
    if (kind === "attack") return createItemIcon({ scene: this.scene, itemId: "sword", size: pos.size, containerScale: this.scale }).setPosition(pos.x, pos.y);
    return this.scene.add.text(pos.x, pos.y, BUTTON_LABELS[kind], uiTextStyle(9, undefined, { scale: this.scale })).setOrigin(0.5, 0.5);
  }
    hitTest(screenX: number, screenY: number): TouchButtonKind | null {
    for (const button of this.buttons) if (button.cell.getBounds().contains(screenX, screenY)) return button.kind;
    return null;
  }
    update(pressed: TouchButtonsPressed, nowMs: number): void {
    const attackAlpha = attackRestAlpha(nowMs - this.sessionStartMs);
    for (const button of this.buttons) {
      button.cell.setFillStyle(...buttonFill(button, pressed, attackAlpha));
    }
  }
    resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
  dispose(registry: WidgetRegistry): void {
    registry.unregister(WIDGET_ID);
    this.container.destroy(true);
  }
}
