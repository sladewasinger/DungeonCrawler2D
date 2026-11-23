/** Overhead player health bar with damage thresholds and fade-out at full HP. */
import type { PlayerSnapshot } from "@dc2d/engine";
import { Container, Graphics, Text } from "pixi.js";

const BAR_WIDTH = 20;
const BAR_HEIGHT = 3.2;
const INNER_WIDTH = BAR_WIDTH - 2;
const INNER_HEIGHT = BAR_HEIGHT - 1.4;
const FULL_HOLD_SEC = 3.0;
const FADE_SEC = 0.6;

export function createPlayerNameLabel(name: string): Text {
  const label = new Text({
    text: name, resolution: 2, roundPixels: false, textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 28, fontWeight: "700", fill: 0xf8fafc,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      stroke: { color: 0x0f172a, width: 6, join: "round" },
    },
  });
  label.anchor.set(0.5, 1);
  label.scale.set(0.24);
  label.position.set(0, -27);
  return label;
}

function isBarActive(snap: PlayerSnapshot, ratio: number): boolean {
  return ratio < 0.999 || (snap.hitTimer ?? 0) > 0 || (snap.respawnTimer ?? 0) > 0;
}

function barColor(ratio: number, hitTimer: number): number {
  if (hitTimer > 0.18) return 0xffffff;
  if (ratio > 0.55) return 0x22c55e;
  if (ratio > 0.25) return 0xfacc15;
  return 0xef4444;
}

export class PlayerHpBar {
  readonly root = new Container();
  private readonly bg = new Graphics();
  private readonly fill = new Graphics();
  private hasBeenActive = false;
  private fullHpSinceSec: number | null = null;
  private lastRatio = -1;
  private lastColor = -1;

  constructor() {
    this.bg.rect(-BAR_WIDTH * 0.5, 0, BAR_WIDTH, BAR_HEIGHT).fill({ color: 0x090d14, alpha: 0.88 });
    this.root.addChild(this.bg, this.fill);
    this.root.visible = false;
  }

  sync(opts: { readonly snap: PlayerSnapshot; readonly jumpPx: number; readonly timeSec: number }): boolean {
    const { snap, jumpPx, timeSec } = opts;
    const maxHp = Math.max(1, snap.maxHp ?? 100);
    const hp = Math.max(0, Math.min(maxHp, snap.hp ?? maxHp));
    const ratio = hp / maxHp;
    const alpha = this.computeVisibilityAlpha(isBarActive(snap, ratio), timeSec);
    if (alpha <= 0) {
      this.root.visible = false;
      return false;
    }
    this.root.visible = true;
    this.root.alpha = alpha;
    this.root.position.set(0, -29 - jumpPx);
    this.redrawFill(ratio, barColor(ratio, snap.hitTimer ?? 0));
    return true;
  }

  private computeVisibilityAlpha(active: boolean, timeSec: number): number {
    if (active) {
      this.hasBeenActive = true;
      this.fullHpSinceSec = null;
      return 1;
    }
    if (!this.hasBeenActive) return 0;
    if (this.fullHpSinceSec === null) this.fullHpSinceSec = timeSec;
    const elapsed = timeSec - this.fullHpSinceSec;
    if (elapsed >= FULL_HOLD_SEC) {
      this.hasBeenActive = false;
      this.fullHpSinceSec = null;
      return 0;
    }
    const fadeStart = FULL_HOLD_SEC - FADE_SEC;
    return elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / FADE_SEC) : 1;
  }

  private redrawFill(ratio: number, color: number): void {
    if (Math.abs(ratio - this.lastRatio) < 0.005 && color === this.lastColor) return;
    this.lastRatio = ratio;
    this.lastColor = color;
    this.fill.clear();
    if (ratio <= 0) return;
    const w = Math.max(1, INNER_WIDTH * ratio);
    this.fill.rect(-INNER_WIDTH * 0.5, 0.7, w, INNER_HEIGHT).fill(color);
  }
}
