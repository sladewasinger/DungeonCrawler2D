/**
 * Virtual movement joystick HUD widget (mobile pass): a base ring + thumb nub in
 * the panel language, registered bottom-left. It's a *floating* joystick — the
 * InputController summons it at the touch point (input/pointer.ts), so this
 * widget's own registry position is only its idle rest pose; update() re-homes
 * the container to the live touch point while a drag is active.
 */
import type Phaser from "phaser";
import { STICK_RADIUS_PX } from "../../../input/touch/index.js";
import type { TouchVisualSnapshot } from "../../../input/touch/index.js";
import { PANEL_BORDER, PANEL_FILL, SELECTION_ACCENT } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";

const WIDGET_ID = "touch-stick";
const NUB_IDLE_COLOR = 0xc9c9d6;
const NUB_RADIUS = STICK_RADIUS_PX * 0.42;

function drawRing(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const ring = scene.add.graphics();
  ring.fillStyle(PANEL_FILL, 0.55);
  ring.fillCircle(0, 0, STICK_RADIUS_PX);
  ring.lineStyle(1, PANEL_BORDER, 1);
  ring.strokeCircle(0, 0, STICK_RADIUS_PX);
  return ring;
}

/** Clamps the nub's drawn offset to the ring so it never renders past the base — logic (joystick.ts) has no such cap, it just deadzones/sectors past this radius. */
function clampToRing(dx: number, dy: number): { x: number; y: number } {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= STICK_RADIUS_PX || magnitude === 0) return { x: dx, y: dy };
  const scale = STICK_RADIUS_PX / magnitude;
  return { x: dx * scale, y: dy * scale };
}

export class TouchStickWidget {
  private readonly container: Phaser.GameObjects.Container;
  private readonly nub: Phaser.GameObjects.Arc;
  private restX = 0;
  private restY = 0;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "bottom-left",
      defaultOffset: { x: 48, y: -92 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.restX = layout.x;
    this.restY = layout.y;
    this.nub = scene.add.circle(0, 0, NUB_RADIUS, NUB_IDLE_COLOR, 0.75);
    this.container.add([drawRing(scene), this.nub]);
  }

  /** Drives the floating re-home + nub drag + active tint from this frame's touch snapshot. */
  update(stick: TouchVisualSnapshot["stick"]): void {
    if (!stick) {
      this.container.setPosition(this.restX, this.restY);
      this.nub.setPosition(0, 0);
      this.nub.setFillStyle(NUB_IDLE_COLOR, 0.75);
      return;
    }
    this.container.setPosition(stick.x, stick.y);
    const clamped = clampToRing(stick.dx, stick.dy);
    this.nub.setPosition(clamped.x, clamped.y);
    this.nub.setFillStyle(SELECTION_ACCENT, 0.9);
  }

  /** Re-resolves this widget's idle screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (!layout) return;
    this.restX = layout.x;
    this.restY = layout.y;
    syncWidgetContainer(this.container, layout);
  }
}
