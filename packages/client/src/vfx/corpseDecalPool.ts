// Pooled corpse/bone decals: one per enemy kill, hard-capped, brief fade
// (corpseDecalMotion.ts) — reuses bloodDecalPool.ts's exact grow/recycle shape and
// bloodDecalSlots.ts's pure cap arithmetic, per the wave-7 "blood-decal pool
// pattern" brief. A bone-pale cross Shape (not a sprite — no bone art in the atlas),
// alpha-blended so it reads on any floor tone without glowing.
import Phaser from "phaser";
import { depthForEntityNow, worldToScreen } from "../render/entities/worldToScreen.js";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";
import { corpseDecalAlpha, isCorpseDecalExpired } from "./corpseDecalMotion.js";

export const CORPSE_DECAL_CAP = 24;
const BASE_ALPHA = 0.75;
const BONE_COLOR = 0xd8cdb8;
const CROSS_LENGTH_PX = 14;
const CROSS_THICKNESS_PX = 3;
const DEPTH_BIAS = -0.25;

interface CorpseDecal {
  readonly container: Phaser.GameObjects.Container;
  spawnMs: number;
}

export class CorpseDecalPool {
  private readonly decals: CorpseDecal[] = [];
  private cursor = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Places one bone-cross decal near (worldX, worldY) — grows the pool until
   * CORPSE_DECAL_CAP, then recycles the oldest-cycled slot round-robin. */
  spawn(worldX: number, worldY: number, nowMs: number): void {
    const decal = shouldGrowPool(this.decals.length, CORPSE_DECAL_CAP) ? this.grow() : this.recycle();
    this.place(decal, worldX, worldY, nowMs);
  }

  private grow(): CorpseDecal {
    const decal: CorpseDecal = { container: this.buildShape(), spawnMs: -Infinity };
    this.decals.push(decal);
    return decal;
  }

  private recycle(): CorpseDecal {
    const index = recycleSlotIndex(this.cursor, CORPSE_DECAL_CAP);
    this.cursor++;
    // Index is always in range: recycle() only runs once the pool has grown to CORPSE_DECAL_CAP.
    return this.decals[index]!;
  }

  private buildShape(): Phaser.GameObjects.Container {
    const vertical = this.scene.add.rectangle(0, 0, CROSS_THICKNESS_PX, CROSS_LENGTH_PX, BONE_COLOR);
    const horizontal = this.scene.add.rectangle(0, 0, CROSS_LENGTH_PX, CROSS_THICKNESS_PX, BONE_COLOR);
    return this.scene.add.container(0, 0, [vertical, horizontal]).setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private place(decal: CorpseDecal, worldX: number, worldY: number, nowMs: number): void {
    const screen = worldToScreen(worldX, worldY);
    const scatterPx = 6;
    const scatterX = (Math.random() - 0.5) * scatterPx;
    const scatterY = (Math.random() - 0.5) * scatterPx;
    decal.container
      .setPosition(screen.x + scatterX, screen.y + scatterY)
      .setRotation(Math.random() * Math.PI)
      .setAlpha(BASE_ALPHA)
      .setVisible(true)
      .setDepth(depthForEntityNow(worldX, worldY) + DEPTH_BIAS);
    decal.spawnMs = nowMs;
  }

  /** Fades every live decal, hiding it once past its brief lifetime (the Shape is kept for reuse). */
  update(nowMs: number): void {
    for (const decal of this.decals) {
      const elapsed = nowMs - decal.spawnMs;
      const expired = isCorpseDecalExpired(elapsed);
      decal.container.setAlpha(corpseDecalAlpha(elapsed, BASE_ALPHA)).setVisible(!expired);
    }
  }

  dispose(): void {
    for (const decal of this.decals) decal.container.destroy();
    this.decals.length = 0;
    this.cursor = 0;
  }
}
