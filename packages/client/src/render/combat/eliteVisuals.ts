/** Golden pulsing aura ring and title nameplate rendered for Elite frontier creatures. */
import type { WorldEntitySnapshot } from "@dc2d/engine";
import { Graphics, Text } from "pixi.js";

const FONT_STYLE = {
  fontFamily: "\"Trebuchet MS\", system-ui, sans-serif",
  fontSize: 9,
  fontWeight: "bold" as const,
  fill: "#fde047",
  stroke: { color: "#090d14", width: 3 },
};

export class EliteVisuals {
  readonly aura = new Graphics();
  readonly label = new Text({ text: "", style: FONT_STYLE });
  private lastTitle = "";

  constructor(private readonly topY: number) {
    this.aura.visible = false;
    this.label.anchor.set(0.5, 1);
    this.label.visible = false;
  }

  sync(snap: WorldEntitySnapshot, dead: boolean, timeSec: number): void {
    const active = Boolean(snap.isElite) && !dead;
    this.aura.visible = active;
    this.label.visible = active && Boolean(snap.title);
    if (!active) return;
    const pulse = 1 + Math.sin(timeSec * 4.2) * 0.08;
    this.aura.clear();
    this.aura.ellipse(0, 1, 13 * pulse, 7 * pulse).stroke({ color: 0xfacc15, width: 1.8, alpha: 0.78 });
    this.aura.ellipse(0, 1, 10 * pulse, 5.2 * pulse).fill({ color: 0xf59e0b, alpha: 0.16 });
    const title = `★ ${snap.title ?? "Elite"}`;
    if (this.lastTitle !== title) {
      this.lastTitle = title;
      this.label.text = title;
    }
    this.label.position.set(0, this.topY - 7);
  }
}
