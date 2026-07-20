/**
 * Touch action buttons HUD widget (mobile pass): a controller-style cluster
 * bottom-right — ATTACK (sword icon), JUMP, INTERACT/pickup — thumb targets
 * that stay out of the way at rest (low opacity) and light up under a finger.
 * Hit-tested the same way the hotbar is (ui/widgets/hud/index.ts's hitTest),
 * so InputController routes taps through the one pointerdown pipeline.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { createItemIcon } from "./itemIcon.js";

const WIDGET_ID = "touch-buttons";
/** Wave-6 playtest ("buttons are way too large... barely any screen real estate"):
 * cut ~25% off every diameter from the original 44/34/34 set, still comfortably
 * above the ~44px onscreen thumb-target floor once hudScale is folded in. */
const ATTACK_SIZE = 34;
const JUMP_SIZE = 26;
const INTERACT_SIZE = 26;
const GAP = 5;
/** Resting/pressed fill alpha — low at rest so the cluster doesn't visually crowd the
 * scene, full the moment a finger is actually on it (wave-6 playtest, "barely any
 * screen real estate"). */
const REST_ALPHA = 0.35;
const PRESSED_ALPHA = 1;

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
  private readonly scale: number;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-right",
      // Tucked closer to the corner than the original {-16,-50} now that the cluster
      // itself is smaller (wave-6 playtest) — keep in sync with default-layout.json's
      // "touch-buttons" entry, which still wins as the active override.
      defaultOffset: { x: -12, y: -40 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.scale = layout.scale;
    this.container = createWidgetContainer(scene, layout);
    const positions = buttonPositions();
    this.buildButton("attack", positions.attack);
    this.buildButton("jump", positions.jump);
    this.buildButton("interact", positions.interact);
  }

  private buildButton(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): void {
    const cell = this.scene.add.circle(pos.x, pos.y, pos.size / 2, PANEL_FILL, REST_ALPHA).setStrokeStyle(1, PANEL_BORDER);
    this.container.add(cell);
    this.container.add(this.buildGlyph(kind, pos));
    this.buttons.push({ kind, x: pos.x, y: pos.y, size: pos.size, cell });
  }

  private buildGlyph(kind: TouchButtonKind, pos: { x: number; y: number; size: number }): Phaser.GameObjects.GameObject {
    if (kind === "attack") return createItemIcon(this.scene, "sword", pos.size, this.scale).setPosition(pos.x, pos.y);
    const label = kind === "jump" ? "JUMP" : "USE";
    return this.scene.add.text(pos.x, pos.y, label, uiTextStyle(9, undefined, this.scale)).setOrigin(0.5, 0.5);
  }

  /** Screen-space hit test (pointer coords) — returns "touch:<kind>" for InputHud.hitTest, or null. */
  hitTest(screenX: number, screenY: number): TouchButtonKind | null {
    for (const button of this.buttons) if (button.cell.getBounds().contains(screenX, screenY)) return button.kind;
    return null;
  }

  /** Pressed-state tint per button from this frame's touch snapshot. */
  update(pressed: { attack: boolean; jump: boolean; interact: boolean }): void {
    for (const button of this.buttons) {
      button.cell.setFillStyle(pressed[button.kind] ? SELECTION_ACCENT : PANEL_FILL, pressed[button.kind] ? PRESSED_ALPHA : REST_ALPHA);
    }
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}
