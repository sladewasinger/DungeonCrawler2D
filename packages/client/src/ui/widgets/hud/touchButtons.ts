/**
 * Touch action buttons HUD widget (mobile pass): a controller-style cluster
 * bottom-right — ATTACK (big, sword icon), JUMP, INTERACT/pickup — each a
 * comfortable >=64px (visual, at hudScale) thumb target with a pressed tint.
 * Hit-tested the same way the hotbar is (ui/widgets/hud/index.ts's hitTest),
 * so InputController routes taps through the one pointerdown pipeline.
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { createItemIcon } from "./itemIcon.js";

const WIDGET_ID = "touch-buttons";
const ATTACK_SIZE = 44;
const JUMP_SIZE = 34;
const INTERACT_SIZE = 34;
const GAP = 6;

export type TouchButtonKind = "attack" | "jump" | "interact";

interface ButtonVisual {
  kind: TouchButtonKind;
  x: number;
  y: number;
  size: number;
  cell: Phaser.GameObjects.Arc;
}

/**
 * attack bottom-right-most (closest to the corner/thumb, biggest); jump directly
 * above it; interact beside jump on the same row — a 2-row cluster rather than a
 * single wide row, so the whole thing stays narrow enough not to reach into the
 * floating joystick's territory on a narrow (~390px) portrait phone.
 */
function buttonPositions(): Record<TouchButtonKind, { x: number; y: number; size: number }> {
  const attack = { x: -ATTACK_SIZE / 2, y: -ATTACK_SIZE / 2, size: ATTACK_SIZE };
  const jump = { x: attack.x, y: -(ATTACK_SIZE + GAP + JUMP_SIZE / 2), size: JUMP_SIZE };
  const interact = { x: jump.x - (JUMP_SIZE / 2 + GAP + INTERACT_SIZE / 2), y: jump.y, size: INTERACT_SIZE };
  return { attack, jump, interact };
}

export class TouchButtonsWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttons: ButtonVisual[] = [];

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-right",
      defaultOffset: { x: -16, y: -50 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    const positions = buttonPositions();
    this.buildButton("attack", positions.attack);
    this.buildButton("jump", positions.jump);
    this.buildButton("interact", positions.interact);
  }

  private buildButton(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): void {
    const cell = this.scene.add.circle(pos.x, pos.y, pos.size / 2, PANEL_FILL, 0.7).setStrokeStyle(1, PANEL_BORDER);
    this.container.add(cell);
    this.container.add(this.buildGlyph(kind, pos));
    this.buttons.push({ kind, x: pos.x, y: pos.y, size: pos.size, cell });
  }

  private buildGlyph(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): Phaser.GameObjects.GameObject {
    if (kind === "attack") return createItemIcon(this.scene, "sword", pos.size).setPosition(pos.x, pos.y);
    const label = kind === "jump" ? "JUMP" : "USE";
    return this.scene.add.text(pos.x, pos.y, label, pixelTextStyle(9)).setOrigin(0.5, 0.5);
  }

  /** Screen-space hit test (pointer coords) — returns "touch:<kind>" for InputHud.hitTest, or null. */
  hitTest(screenX: number, screenY: number): TouchButtonKind | null {
    for (const button of this.buttons) if (button.cell.getBounds().contains(screenX, screenY)) return button.kind;
    return null;
  }

  /** Pressed-state tint per button from this frame's touch snapshot. */
  update(pressed: { attack: boolean; jump: boolean; interact: boolean }): void {
    for (const button of this.buttons) button.cell.setFillStyle(pressed[button.kind] ? SELECTION_ACCENT : PANEL_FILL, pressed[button.kind] ? 0.85 : 0.7);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
