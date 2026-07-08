import { content } from "@dc2d/content";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import atlas from "./atlas.json";
import { TILE_PX } from "./constants";

/** Area-effect tiles (fire, poison, oil, water) mirrored from server state. */
export class AreaRenderer {
  private readonly images = new Map<string, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(conn: Connection): void {
    const live = conn.areaTiles;
    for (const [key, image] of this.images) {
      if (!live.has(key)) {
        image.destroy();
        this.images.delete(key);
      }
    }
    for (const [key, defId] of live) {
      const existing = this.images.get(key);
      const spriteName = content.areas.get(defId)?.sprite ?? "steam";
      const frame =
        (atlas.frames.areas as Record<string, number>)[spriteName] ?? atlas.frames.areas.steam;
      if (existing) {
        if (existing.frame.name !== String(frame)) existing.setFrame(frame);
        continue;
      }
      const [x, y] = key.split(",").map(Number) as [number, number];
      const image = this.scene.add
        .image(x * TILE_PX, y * TILE_PX, "tiles", frame)
        .setOrigin(0, 0)
        .setDepth(-5)
        .setAlpha(0.8);
      this.images.set(key, image);
    }
  }
}
