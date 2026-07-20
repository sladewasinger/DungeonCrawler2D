/**
 * Toast stack HUD widget: renders Connection.toasts (net/apply.ts's server "toast"
 * events, plus client-local ones pushed for failed actions — Connection.pushToast)
 * top-center, newest on top, each on its own pill that fades out over its final
 * TOAST_FADE_MS before expiring (toastQueue.ts's pure visibleToasts). This is the
 * "conn.toasts exists and had no renderer" fix (Epic 7.13 onboarding lane) — until
 * now only the open craft/stash windows ever showed a toast, as their own footer line.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { ToastData } from "./fakeData.js";
import { visibleToasts } from "./toastQueue.js";

const WIDGET_ID = "toast";
export const MAX_VISIBLE = 3;
const ROW_GAP = 4;
const PANEL_V_PADDING = 6;
/** Never wraps wider than this even on a roomy desktop viewport, and never wider than
 * the viewport itself on a narrow mobile-landscape one (wave7b-mobile-clean.png finding:
 * an un-wrapped long toast ran clean off a 390px-tall/844px-wide phone screen). */
const MAX_WRAP_WIDTH = 360;
const VIEWPORT_MARGIN = 32;

interface ToastRow {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

export class ToastStackWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: ToastRow[] = [];
  private readonly scale: number;
  private wrapWidth: number;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport) {
    this.scene = scene;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "top-center",
      defaultOffset: { x: 0, y: 16 },
      defaultScale: 1,
      defaultVisible: true,
    });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.scale = layout.scale;
    this.wrapWidth = wrapWidthFor(viewport, this.scale);
    this.container = createWidgetContainer(scene, layout);
    for (let i = 0; i < MAX_VISIBLE; i++) this.rows.push(this.buildRow());
  }

  private buildRow(): ToastRow {
    const bg = this.scene.add.graphics().setVisible(false);
    const text = this.scene.add
      .text(0, 0, "", { ...uiTextStyle(11, undefined, this.scale), align: "center" })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.container.add([bg, text]);
    return { bg, text };
  }

  update(toasts: readonly ToastData[], nowMs: number): void {
    const views = visibleToasts(toasts, nowMs).slice(0, MAX_VISIBLE);
    let y = 0;
    for (const [index, row] of this.rows.entries()) {
      const view = views[index];
      if (!view) {
        row.bg.setVisible(false);
        row.text.setVisible(false);
        continue;
      }
      row.text.setStyle({ wordWrap: { width: this.wrapWidth } });
      row.text.setPosition(0, y + PANEL_V_PADDING / 2).setText(view.msg).setAlpha(view.alpha).setVisible(true);
      this.redrawBackground(row.bg, y, view.alpha, row.text.width, row.text.height);
      y += row.text.height + PANEL_V_PADDING + ROW_GAP;
    }
  }

  private redrawBackground(bg: Phaser.GameObjects.Graphics, y: number, alpha: number, textWidth: number, textHeight: number): void {
    const width = textWidth + spacing(3);
    const height = textHeight + PANEL_V_PADDING;
    bg.clear();
    bg.fillStyle(0x14141c, 0.75 * alpha);
    bg.fillRoundedRect(-width / 2, y, width, height, 4);
    bg.setVisible(true);
  }

  /** Re-resolves this widget's screen position for a new viewport (call on resize). */
  resize(registry: WidgetRegistry, viewport: Viewport): void {
    this.wrapWidth = wrapWidthFor(viewport, this.scale);
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}

/** Wrap width in the text's own local (pre-scale) units — the container itself is
 * later stretched by `scale` (hudScale × this widget's own scale), so a screen-space
 * viewport budget has to be divided back down or the wrapped text still overflows a
 * narrow phone once the container scale is applied on top of it. Exported for
 * toastStack.test.ts. */
export function wrapWidthFor(viewport: Viewport, scale: number): number {
  return Math.max(120, Math.min(MAX_WRAP_WIDTH, (viewport.width - VIEWPORT_MARGIN) / scale));
}
