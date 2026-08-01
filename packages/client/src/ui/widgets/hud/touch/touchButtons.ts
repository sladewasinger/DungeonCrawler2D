import type Phaser from "phaser";
import tuning from "./touchControlLayout.json" with { type: "json" };
import { uiTextStyle } from "../../../foundation/font.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../../foundation/panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../../container.js";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { createItemIcon } from "../inventory/itemIcon.js";

export type TouchButtonKind = "attack" | "block" | "jump" | "interact" | "throw";
export type TouchButtonId = `touch-${TouchButtonKind}`;
export const TOUCH_BUTTON_IDS: readonly TouchButtonId[] = [
  "touch-attack", "touch-block", "touch-jump", "touch-interact", "touch-throw",
];
export const TOUCH_CONTROL_SCALE_LIMITS = {
  minimum: tuning.minimumScale,
  maximum: tuning.maximumScale,
} as const;
export const ORDINARY_TOUCH_BUTTON_SIZE = tuning.ordinaryButtonSize;
export const ATTACK_TOUCH_BUTTON_SIZE = tuning.ordinaryButtonSize * tuning.attackSizeMultiplier;
const REST_ALPHA = 0.35;
const ATTACK_REST_ALPHA = 0.55;
const PRESSED_ALPHA = 1;
export const ATTACK_PULSE_DURATION_MS = 10_000;
const ATTACK_PULSE_PERIOD_MS = 1200;
const ATTACK_PULSE_AMPLITUDE = 0.15;
const BUTTON_LABELS: Record<Exclude<TouchButtonKind, "attack" | "interact">, string> = {
  block: "BLOCK", jump: "JUMP", throw: "THROW",
};

export interface TouchButtonsPressed { attack: boolean; jump: boolean; interact: boolean; block?: boolean; }
export interface MobileInteractionPrompt { readonly label: string; }

export function attackRestAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= ATTACK_PULSE_DURATION_MS) return ATTACK_REST_ALPHA;
  const phase = (elapsedMs % ATTACK_PULSE_PERIOD_MS) / ATTACK_PULSE_PERIOD_MS;
  return ATTACK_REST_ALPHA + ((Math.sin(phase * Math.PI * 2) + 1) / 2) * ATTACK_PULSE_AMPLITUDE;
}

/** Uses the exact interaction prompt already resolved for keyboard input. */
export function mobileInteractionLabel(prompt: MobileInteractionPrompt | null): string {
  return prompt?.label.trim().toLowerCase() === "pick up" ? "PICKUP" : "USE";
}

/** Default centers in local bottom-right coordinates, kept pure for layout coverage. */
export function actionButtonLayout(): Record<TouchButtonKind, { x: number; y: number; size: number }> {
  return Object.fromEntries(TOUCH_BUTTON_IDS.map((id) => {
    const kind = kindFor(id);
    const entry = tuning.defaults[id];
    return [kind, { x: entry.offset.x, y: entry.offset.y, size: buttonSize(kind) }];
  })) as Record<TouchButtonKind, { x: number; y: number; size: number }>;
}

function kindFor(id: TouchButtonId): TouchButtonKind { return id.slice("touch-".length) as TouchButtonKind; }
function buttonSize(kind: TouchButtonKind): number {
  return kind === "attack" ? ATTACK_TOUCH_BUTTON_SIZE : ORDINARY_TOUCH_BUTTON_SIZE;
}

export class TouchActionButtonWidget {
  private readonly scene: Phaser.Scene;
  private readonly id: TouchButtonId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly cell: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text | null;
  private readonly kind: TouchButtonKind;
  private readonly sessionStartMs: number;

  constructor(options: TouchActionButtonOptions) {
    const { scene, id, registry, viewport } = options;
    this.scene = scene;
    this.id = id;
    this.kind = kindFor(id);
    this.sessionStartMs = scene.time.now;
    const defaultLayout = tuning.defaults[id];
    registry.register({ id, defaultAnchor: defaultLayout.anchor as "bottom-right", defaultOffset: defaultLayout.offset, defaultScale: 1, defaultVisible: true });
    const layout = registry.resolve(viewport).get(id)!;
    this.container = createWidgetContainer(scene, layout);
    const size = buttonSize(this.kind);
    this.cell = scene.add.circle(0, 0, size / 2, PANEL_FILL, this.kind === "attack" ? ATTACK_REST_ALPHA : REST_ALPHA).setStrokeStyle(1, PANEL_BORDER);
    const glyph = this.buildGlyph(size, layout.scale);
    this.label = glyph.label;
    this.container.add([this.cell, glyph.object]);
  }

  private buildGlyph(size: number, scale: number): { object: Phaser.GameObjects.GameObject; label: Phaser.GameObjects.Text | null } {
    if (this.kind === "attack") return {
      object: createItemIcon({ scene: this.scene, itemId: "sword", size, containerScale: scale }), label: null,
    };
    const text = this.kind === "interact" ? "USE" : BUTTON_LABELS[this.kind];
    const label = this.scene.add.text(0, 0, text, uiTextStyle(9, undefined, { scale })).setOrigin(0.5);
    return { object: label, label };
  }

  hitTest(screenX: number, screenY: number): boolean { return this.cell.getBounds().contains(screenX, screenY); }

  update({ pressed, nowMs, interactionPrompt, throwAvailable }: TouchButtonUpdate): void {
    this.syncVisibility(throwAvailable);
    const held = this.kind !== "throw" && (pressed[this.kind] ?? false);
    const alpha = this.kind === "attack" ? attackRestAlpha(nowMs - this.sessionStartMs) : REST_ALPHA;
    this.cell.setFillStyle(held ? SELECTION_ACCENT : PANEL_FILL, held ? PRESSED_ALPHA : alpha);
    if (this.kind === "interact") this.label?.setText(mobileInteractionLabel(interactionPrompt));
  }

  private syncVisibility(throwAvailable: boolean): void { if (this.kind === "throw") this.container.setVisible(throwAvailable); }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(this.id);
    if (layout) syncWidgetContainer(this.container, layout);
  }

  dispose(registry: WidgetRegistry): void { registry.unregister(this.id); this.container.destroy(true); }
}

interface TouchButtonUpdate { pressed: TouchButtonsPressed; nowMs: number; interactionPrompt: MobileInteractionPrompt | null; throwAvailable: boolean; }

interface TouchActionButtonOptions {
  readonly scene: Phaser.Scene;
  readonly id: TouchButtonId;
  readonly registry: WidgetRegistry;
  readonly viewport: Viewport;
}
