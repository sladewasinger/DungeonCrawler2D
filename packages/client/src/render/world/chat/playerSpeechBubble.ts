/** World-space overhead pixel-framed speech bubble above PlayerView's name label. */
import type { PlayerBubble } from "@dc2d/engine";
import { Container, Graphics, Text } from "pixi.js";

const MAX_BUBBLE_TEXT_WIDTH = 280;
const BUBBLE_SCALE = 0.22;
const PAD_X = 5;
const PAD_Y = 3;

export class PlayerSpeechBubble {
  readonly root = new Container();
  private readonly bg = new Graphics();
  private label: Text | null = null;
  private lastKey = "";

  constructor() {
    this.root.visible = false;
    this.root.addChild(this.bg);
  }

  sync(opts: { readonly bubble: PlayerBubble | undefined; readonly baseY: number }): void {
    const { bubble, baseY } = opts;
    if (!bubble || bubble.remainingSec <= 0) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.root.position.set(0, baseY);
    const fade = bubble.remainingSec < 0.6 ? Math.max(0, bubble.remainingSec / 0.6) : 1;
    this.root.alpha = fade;

    const key = `${bubble.text}#${Boolean(bubble.shout)}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.rebuildBubble(bubble.text, Boolean(bubble.shout));
    }
  }

  private rebuildBubble(text: string, shout: boolean): void {
    if (this.label) {
      this.label.removeFromParent();
      this.label.destroy(true);
      this.label = null;
    }
    const txt = new Text({
      text: shout ? `! ${text}` : text,
      resolution: 2,
      roundPixels: false,
      textureStyle: { scaleMode: "linear" },
      style: {
        fontSize: 28, fontWeight: "700", fill: shout ? 0xfef08a : 0xf8fafc,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        wordWrap: true, wordWrapWidth: MAX_BUBBLE_TEXT_WIDTH, align: "center",
      },
    });
    txt.anchor.set(0.5, 1);
    txt.scale.set(BUBBLE_SCALE);
    txt.position.set(0, -PAD_Y - 3);
    this.label = txt;
    this.root.addChild(txt);

    const w = Math.max(18, txt.width + PAD_X * 2);
    const h = Math.max(10, txt.height + PAD_Y * 2);
    this.bg.clear();
    this.bg.roundRect(-w * 0.5, -h - 3, w, h, 3)
      .fill({ color: 0x0f172a, alpha: 0.9 })
      .stroke({ color: shout ? 0xfbbf24 : 0x94a3b8, width: 0.9, alpha: 0.95 });
    this.bg.beginPath()
      .moveTo(-2.5, -3).lineTo(0, 0).lineTo(2.5, -3)
      .closePath().fill({ color: 0x0f172a, alpha: 0.9 });
  }

  destroy(): void {
    if (this.label) { this.label.destroy(true); this.label = null; }
    this.bg.destroy();
    this.root.destroy();
  }
}
