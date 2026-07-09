import { content } from "@dc2d/content";
import Phaser from "phaser";
import type { Connection } from "../net/connection";
import atlas from "./atlas.json";
import { TILE_PX } from "./constants";

interface AreaVisual {
  image: Phaser.GameObjects.Image;
  defId: string;
  phase: number;
}

/** Area-effect tiles (fire, poison, oil, water) mirrored from server state. */
export class AreaRenderer {
  private readonly images = new Map<string, AreaVisual>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(conn: Connection): void {
    const live = conn.areaTiles;
    const now = performance.now();
    for (const [key, visual] of this.images) {
      if (!live.has(key)) {
        visual.image.destroy();
        this.images.delete(key);
      }
    }
    for (const [key, defId] of live) {
      const existing = this.images.get(key);
      const spriteName = content.areas.get(defId)?.sprite ?? "steam";
      const frame =
        (atlas.frames.areas as Record<string, number>)[spriteName] ?? atlas.frames.areas.steam;
      if (existing) {
        if (existing.image.frame.name !== String(frame)) existing.image.setFrame(frame);
        existing.defId = defId;
        this.animate(existing, now);
        continue;
      }
      const [x, y] = key.split(",").map(Number) as [number, number];
      const image = this.scene.add
        .image((x + 0.5) * TILE_PX, (y + 0.5) * TILE_PX, "tiles", frame)
        .setOrigin(0.5)
        .setDepth(-5)
        .setDisplaySize(TILE_PX, TILE_PX);
      const visual = { image, defId, phase: phaseFromKey(key) };
      this.images.set(key, visual);
      this.animate(visual, now);
    }
  }

  private animate(visual: AreaVisual, now: number): void {
    const pulse = (Math.sin(now / durationFor(visual.defId) + visual.phase) + 1) * 0.5;
    const alpha = alphaFor(visual.defId, pulse);
    const scale = scaleFor(visual.defId, pulse);
    visual.image.setAlpha(alpha).setScale(scale);
  }
}

function durationFor(defId: string): number {
  if (defId === "area-fire") return 90;
  if (defId === "area-smoke" || defId === "area-steam") return 260;
  if (defId === "area-poison") return 190;
  return 420;
}

function alphaFor(defId: string, pulse: number): number {
  if (defId === "area-fire") return 0.62 + pulse * 0.28;
  if (defId === "area-smoke" || defId === "area-steam") return 0.38 + pulse * 0.24;
  if (defId === "area-poison") return 0.55 + pulse * 0.18;
  return 0.68 + pulse * 0.08;
}

function scaleFor(defId: string, pulse: number): number {
  if (defId === "area-fire") return 0.96 + pulse * 0.09;
  if (defId === "area-smoke" || defId === "area-steam") return 0.97 + pulse * 0.08;
  if (defId === "area-poison") return 0.98 + pulse * 0.05;
  return 1;
}

function phaseFromKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return (hash & 0xffff) / 0xffff * Math.PI * 2;
}
